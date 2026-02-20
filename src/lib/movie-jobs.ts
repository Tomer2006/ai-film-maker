import { randomUUID } from "node:crypto";

import type { Firestore } from "firebase-admin/firestore";

import { getDb } from "./firebase-admin";

const DEFAULT_DONE_TOKEN = "__OPENCODE_DONE__";
const MAX_ITERATIONS = 8;
const MAX_FILES_PER_TURN = 6;

const CREATIVE_FILE_DEFS = [
  { fileKey: "title", title: "Title", fileName: "01-title.md", sortOrder: 10 },
  {
    fileKey: "concept",
    title: "Concept",
    fileName: "02-concept.md",
    sortOrder: 20,
  },
  {
    fileKey: "plot_overview",
    title: "Plot Overview",
    fileName: "03-plot-overview.md",
    sortOrder: 30,
  },
  {
    fileKey: "visual_style",
    title: "Visual Style",
    fileName: "04-visual-style.md",
    sortOrder: 40,
  },
  {
    fileKey: "script",
    title: "Script",
    fileName: "05-script.md",
    sortOrder: 50,
  },
  {
    fileKey: "storyboard_text",
    title: "Storyboard (Text)",
    fileName: "06-storyboard-text.md",
    sortOrder: 60,
  },
] as const;

const ALLOWED_FILE_KEYS: Set<string> = new Set(
  CREATIVE_FILE_DEFS.map((file) => file.fileKey),
);

type AllowedFileKey = (typeof CREATIVE_FILE_DEFS)[number]["fileKey"];
type JobStatus = "queued" | "generating" | "completed" | "failed";
type JobStage =
  | "queued"
  | "pre_production"
  | "production_pending"
  | "production"
  | "idea"
  | "story"
  | "screenplay"
  | "scene_plan"
  | "planning"
  | "scene_generation"
  | "assembly"
  | "completed"
  | "failed";

type UpdatedBy = "system" | "opencode" | "user";

export type JobRecord = {
  movieId: string;
  userId: string;
  status: JobStatus;
  stage: JobStage;
  progress: number;
  message: string;
  totalScenes?: number;
  completedScenes?: number;
  renderProvider?: string;
  renderJobId?: string;
  providerMeta?: unknown;
  finalVideoUrl?: string;
  completionToken?: string;
  error?: string;
  claimedBy?: string;
  claimedAt?: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
};

type MovieRecord = {
  userId: string;
  title: string;
  concept: string;
  plotOverview: string;
  script: string;
  visualStyle: string;
  normalizedContext?: unknown;
  idea?: string;
  story?: string;
  screenplay?: string;
  createdAt: number;
  updatedAt?: number;
};

type MovieCreativeFileRecord = {
  jobId: string;
  movieId: string;
  fileKey: string;
  title: string;
  fileName: string;
  sortOrder: number;
  content: string;
  revision: number;
  updatedBy: UpdatedBy;
  createdAt: number;
  updatedAt: number;
};

export type JobView = JobRecord & { id: string; movieTitle: string };
export type MovieCreativeFileView = MovieCreativeFileRecord & { id: string };
export const PRE_PRODUCTION_FILE_KEYS: AllowedFileKey[] = [
  "title",
  "concept",
  "plot_overview",
  "visual_style",
  "script",
  "storyboard_text",
];

type OpencodeUpdate = {
  fileKey: string;
  title?: string;
  content: string;
};

type OpencodeModelResponse = {
  stage?: string;
  progress?: number;
  message?: string;
  done?: boolean;
  doneToken?: string;
  updates?: OpencodeUpdate[];
};

type OpencodeContext = {
  jobId: string;
  movieId: string;
  job: JobRecord;
  movie: MovieRecord;
  files: MovieCreativeFileView[];
};

export type CreateMovieInput = {
  userId: string;
  title: string;
  concept: string;
  plotOverview: string;
  script: string;
  visualStyle: string;
};

export type CompleteWebhookInput = {
  renderJobId: string;
  status: "queued" | "rendering" | "done" | "failed";
  finalVideoUrl?: string;
  error?: string;
  providerMeta?: unknown;
};

function normalizeText(value: string | undefined | null): string {
  return value?.trim() ?? "";
}

function clampProgress(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function stageFromModel(stage: string | undefined): JobStage {
  if (!stage) return "pre_production";
  const normalized = stage.trim().toLowerCase();
  if (normalized === "pre_production" || normalized === "pre-production") {
    return "pre_production";
  }
  if (normalized === "production_pending" || normalized === "production-pending") {
    return "production_pending";
  }
  if (normalized === "production") return "production";
  if (normalized === "idea") return "idea";
  if (normalized === "story") return "story";
  if (normalized === "screenplay") return "screenplay";
  if (normalized === "scene_plan") return "scene_plan";
  if (normalized === "planning") return "planning";
  return "pre_production";
}

function toMarkdownDocument(title: string, content: string): string {
  const body = normalizeText(content);
  if (!body) {
    return `# ${title}\n\n_TODO_\n`;
  }
  return `# ${title}\n\n${body}\n`;
}

function fromMarkdownDocument(content: string | undefined): string {
  const normalized = normalizeText(content);
  if (!normalized) return "";
  return normalized.replace(/^#\s+[^\n]*\n+/, "").trim();
}

function extractContentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  const parts: string[] = [];
  for (const part of content) {
    if (
      part &&
      typeof part === "object" &&
      "text" in part &&
      typeof (part as { text?: unknown }).text === "string"
    ) {
      parts.push((part as { text: string }).text);
    }
  }

  return parts.join("\n");
}

function extractJsonObject(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    return raw.trim();
  }

  return raw.slice(firstBrace, lastBrace + 1).trim();
}

function getOpencodeBaseUrl(): string {
  const baseUrl =
    process.env.OPENCODE_BASE_URL?.trim() ??
    process.env.OPENCODE_SERVER_URL?.trim();

  if (!baseUrl) {
    throw new Error(
      "Missing OPENCODE_BASE_URL (or OPENCODE_SERVER_URL) for Opencode integration.",
    );
  }

  return baseUrl.replace(/\/+$/, "");
}

function getOpencodeHeaders(): HeadersInit {
  const username = process.env.OPENCODE_SERVER_USERNAME?.trim() || "opencode";
  const password = process.env.OPENCODE_SERVER_PASSWORD?.trim();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (password) {
    const encoded = Buffer.from(`${username}:${password}`).toString("base64");
    headers.Authorization = `Basic ${encoded}`;
  }

  return headers;
}

async function createOpencodeSession(): Promise<string> {
  const response = await fetch(`${getOpencodeBaseUrl()}/session`, {
    method: "POST",
    headers: getOpencodeHeaders(),
    body: JSON.stringify({
      title: "Firebase Movie Planner",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Opencode session creation failed (${response.status}): ${errorText}`,
    );
  }

  const payload = (await response.json()) as { id?: string };
  const sessionId = normalizeText(payload.id);
  if (!sessionId) {
    throw new Error("Opencode session creation returned no session id.");
  }

  return sessionId;
}

function parseOpencodeModelResponse(payload: unknown): OpencodeModelResponse {
  if (!payload || typeof payload !== "object") {
    throw new Error("Opencode message returned invalid payload.");
  }

  const asRecord = payload as Record<string, unknown>;
  const info =
    asRecord.info && typeof asRecord.info === "object"
      ? (asRecord.info as Record<string, unknown>)
      : undefined;

  const structured = info?.structured_output ?? info?.structuredOutput;

  if (structured && typeof structured === "object") {
    return structured as OpencodeModelResponse;
  }

  const rawContent = extractContentText(asRecord.parts);
  if (!rawContent.trim()) {
    throw new Error("Opencode returned an empty response.");
  }

  const jsonText = extractJsonObject(rawContent);
  try {
    return JSON.parse(jsonText) as OpencodeModelResponse;
  } catch {
    throw new Error(`Opencode response was not valid JSON: ${rawContent}`);
  }
}

async function callOpencodeMessage(args: {
  sessionId: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<OpencodeModelResponse> {
  const model = process.env.OPENCODE_MODEL?.trim();

  const response = await fetch(
    `${getOpencodeBaseUrl()}/session/${args.sessionId}/message`,
    {
      method: "POST",
      headers: getOpencodeHeaders(),
      body: JSON.stringify({
        ...(model ? { model } : {}),
        system: args.systemPrompt,
        parts: [{ type: "text", text: args.userPrompt }],
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Opencode message failed (${response.status}): ${errorText}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  return parseOpencodeModelResponse(payload);
}

async function closeOpencodeSession(sessionId: string): Promise<void> {
  const response = await fetch(`${getOpencodeBaseUrl()}/session/${sessionId}`, {
    method: "DELETE",
    headers: getOpencodeHeaders(),
  });

  if (!response.ok && response.status !== 404) {
    const errorText = await response.text();
    throw new Error(
      `Opencode session delete failed (${response.status}): ${errorText}`,
    );
  }
}

function buildInitialFiles(input: {
  title: string;
  concept: string;
  plotOverview: string;
  script: string;
  visualStyle: string;
}) {
  const now = Date.now();

  return CREATIVE_FILE_DEFS.map((file) => {
    let content = "";
    if (file.fileKey === "title") {
      content = toMarkdownDocument("Title", normalizeText(input.title));
    } else if (file.fileKey === "concept") {
      content = toMarkdownDocument("Concept", normalizeText(input.concept));
    } else if (file.fileKey === "plot_overview") {
      content = toMarkdownDocument(
        "Plot Overview",
        normalizeText(input.plotOverview) || normalizeText(input.concept),
      );
    } else if (file.fileKey === "visual_style") {
      content = toMarkdownDocument("Visual Style", normalizeText(input.visualStyle));
    } else if (file.fileKey === "script") {
      content = toMarkdownDocument("Script", normalizeText(input.script));
    } else if (file.fileKey === "storyboard_text") {
      content = toMarkdownDocument(
        "Storyboard (Text)",
        [
          "## Scene 1",
          "- Shot: ",
          "- Visual: ",
          "- Dialogue/Audio: ",
          "",
          "## Scene 2",
          "- Shot: ",
          "- Visual: ",
          "- Dialogue/Audio: ",
        ].join("\n"),
      );
    }

    return {
      ...file,
      content,
      revision: 1,
      updatedBy: "system" as const,
      createdAt: now,
      updatedAt: now,
    };
  });
}

function mapFilesForPrompt(files: MovieCreativeFileView[]) {
  return files
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((file) => ({
      fileKey: file.fileKey,
      title: file.title,
      fileName: file.fileName || `${file.fileKey}.md`,
      revision: file.revision,
      content: file.content,
    }));
}

function hasCoreFilesCompleted(files: MovieCreativeFileView[]) {
  const byKey = new Map(files.map((file) => [file.fileKey, file]));
  const required: Array<{ key: AllowedFileKey; minLength: number }> = [
    { key: "title", minLength: 3 },
    { key: "concept", minLength: 20 },
    { key: "plot_overview", minLength: 20 },
    { key: "visual_style", minLength: 20 },
    { key: "script", minLength: 20 },
    { key: "storyboard_text", minLength: 20 },
  ];
  return required.every(
    ({ key, minLength }) =>
      fromMarkdownDocument(byKey.get(key)?.content).length >= minLength,
  );
}

function defaultProgressForIteration(iteration: number): number {
  return Math.min(95, 15 + iteration * 10);
}

function creativeFileDocId(jobId: string, fileKey: string) {
  return `${jobId}__${fileKey}`;
}

function compactObject<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

function getCollections(db: Firestore) {
  return {
    movies: db.collection("movies"),
    jobs: db.collection("jobs"),
    movieCreativeFiles: db.collection("movieCreativeFiles"),
    movieScenes: db.collection("movieScenes"),
  };
}

async function getOpencodeContext(jobId: string): Promise<OpencodeContext | null> {
  const db = getDb();
  const { jobs, movies, movieCreativeFiles } = getCollections(db);
  const jobSnapshot = await jobs.doc(jobId).get();
  if (!jobSnapshot.exists) return null;

  const job = jobSnapshot.data() as JobRecord;
  const movieSnapshot = await movies.doc(job.movieId).get();
  if (!movieSnapshot.exists) return null;

  const filesSnapshot = await movieCreativeFiles.where("jobId", "==", jobId).get();
  const files = filesSnapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as MovieCreativeFileRecord) }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    jobId: jobSnapshot.id,
    movieId: movieSnapshot.id,
    job,
    movie: movieSnapshot.data() as MovieRecord,
    files,
  };
}

async function applyOpencodeUpdates(args: {
  jobId: string;
  movieId: string;
  updates: OpencodeUpdate[];
}) {
  const db = getDb();
  const { movieCreativeFiles } = getCollections(db);
  const now = Date.now();

  for (const update of args.updates.slice(0, MAX_FILES_PER_TURN)) {
    const rawKey = update.fileKey.trim().toLowerCase();
    if (!ALLOWED_FILE_KEYS.has(rawKey)) {
      continue;
    }
    const key = rawKey as AllowedFileKey;
    const docId = creativeFileDocId(args.jobId, key);
    const fileRef = movieCreativeFiles.doc(docId);
    const existing = await fileRef.get();

    if (!existing.exists) {
      const template = CREATIVE_FILE_DEFS.find((file) => file.fileKey === key);
      await fileRef.set({
        jobId: args.jobId,
        movieId: args.movieId,
        fileKey: key,
        title: normalizeText(update.title) || template?.title || key,
        fileName: template?.fileName || `${key}.md`,
        sortOrder: template?.sortOrder ?? 999,
        content: update.content,
        revision: 1,
        updatedBy: "opencode",
        createdAt: now,
        updatedAt: now,
      } satisfies MovieCreativeFileRecord);
    } else {
      const current = existing.data() as MovieCreativeFileRecord;
      await fileRef.set(
        {
          title: normalizeText(update.title) || current.title,
          content: update.content,
          revision: current.revision + 1,
          updatedBy: "opencode",
          updatedAt: now,
        },
        { merge: true },
      );
    }
  }
}

async function updateJobState(args: {
  jobId: string;
  status: JobStatus;
  stage: JobStage;
  progress: number;
  message: string;
  completionToken?: string;
  error?: string;
}) {
  const db = getDb();
  const { jobs } = getCollections(db);
  const ref = jobs.doc(args.jobId);
  const snapshot = await ref.get();
  if (!snapshot.exists) return;

  const job = snapshot.data() as JobRecord;
  const now = Date.now();
  await ref.set(
    compactObject({
      status: args.status,
      stage: args.stage,
      progress: clampProgress(args.progress, job.progress),
      message: args.message,
      completionToken: args.completionToken ?? job.completionToken,
      error: args.error,
      updatedAt: now,
      completedAt: args.status === "completed" ? now : job.completedAt,
    }),
    { merge: true },
  );
}

async function syncMovieFromCreativeFiles(jobId: string) {
  const context = await getOpencodeContext(jobId);
  if (!context) return;

  const db = getDb();
  const { movies } = getCollections(db);
  const byKey = new Map(context.files.map((file) => [file.fileKey, file]));
  const title = fromMarkdownDocument(byKey.get("title")?.content);
  const concept = fromMarkdownDocument(byKey.get("concept")?.content);
  const plotOverview = fromMarkdownDocument(byKey.get("plot_overview")?.content);
  const visualStyle = fromMarkdownDocument(byKey.get("visual_style")?.content);
  const script = fromMarkdownDocument(byKey.get("script")?.content);
  const now = Date.now();

  await movies.doc(context.movieId).set(
    {
      title: title || context.movie.title,
      concept: concept || context.movie.concept,
      plotOverview: plotOverview || context.movie.plotOverview,
      script: script || context.movie.script,
      visualStyle: visualStyle || context.movie.visualStyle,
      idea: concept || context.movie.idea || context.movie.concept,
      story: plotOverview || context.movie.story || context.movie.plotOverview,
      screenplay: script || context.movie.screenplay || context.movie.script,
      updatedAt: now,
    },
    { merge: true },
  );
}

export async function createMovieAndQueueJob(args: CreateMovieInput) {
  const db = getDb();
  const { jobs, movies, movieCreativeFiles } = getCollections(db);

  const now = Date.now();
  const title = normalizeText(args.title) || "Untitled Movie";
  const concept = normalizeText(args.concept);
  const plotOverview = normalizeText(args.plotOverview);
  const script = normalizeText(args.script);
  const visualStyle = normalizeText(args.visualStyle);

  const movieRef = movies.doc(randomUUID());
  const jobRef = jobs.doc(randomUUID());

  const batch = db.batch();

  batch.set(movieRef, {
    userId: args.userId,
    title,
    concept,
    plotOverview,
    script,
    visualStyle,
    idea: concept,
    story: plotOverview,
    screenplay: script,
    createdAt: now,
    updatedAt: now,
  } satisfies MovieRecord);

  batch.set(jobRef, {
    movieId: movieRef.id,
    userId: args.userId,
    status: "queued",
    stage: "queued",
    progress: 0,
    message: "Queued for OpenCode Step 1 (pre-production).",
    createdAt: now,
    updatedAt: now,
  } satisfies JobRecord);

  const initialFiles = buildInitialFiles({
    title,
    concept,
    plotOverview,
    script,
    visualStyle,
  });

  for (const file of initialFiles) {
    const ref = movieCreativeFiles.doc(creativeFileDocId(jobRef.id, file.fileKey));
    batch.set(ref, {
      jobId: jobRef.id,
      movieId: movieRef.id,
      fileKey: file.fileKey,
      title: file.title,
      fileName: file.fileName,
      sortOrder: file.sortOrder,
      content: file.content,
      revision: file.revision,
      updatedBy: file.updatedBy,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    } satisfies MovieCreativeFileRecord);
  }

  await batch.commit();
  return jobRef.id;
}

export async function listJobsByUser(userId: string): Promise<JobView[]> {
  const db = getDb();
  const { jobs, movies } = getCollections(db);
  const snapshot = await jobs.where("userId", "==", userId).get();

  const result: JobView[] = [];

  for (const doc of snapshot.docs) {
    const job = doc.data() as JobRecord;
    const movieSnapshot = await movies.doc(job.movieId).get();
    result.push({
      id: doc.id,
      ...job,
      movieTitle: (movieSnapshot.data() as MovieRecord | undefined)?.title ?? "Unknown movie",
    });
  }

  result.sort((a, b) => b.createdAt - a.createdAt);
  return result;
}

export async function getJob(jobId: string): Promise<JobView | null> {
  const db = getDb();
  const { jobs, movies } = getCollections(db);
  const jobSnapshot = await jobs.doc(jobId).get();
  if (!jobSnapshot.exists) return null;

  const job = jobSnapshot.data() as JobRecord;
  const movieSnapshot = await movies.doc(job.movieId).get();

  return {
    id: jobSnapshot.id,
    ...job,
    movieTitle: (movieSnapshot.data() as MovieRecord | undefined)?.title ?? "Unknown movie",
  };
}

export async function listCreativeFiles(jobId: string): Promise<MovieCreativeFileView[]> {
  const db = getDb();
  const { movieCreativeFiles } = getCollections(db);
  const filesSnapshot = await movieCreativeFiles.where("jobId", "==", jobId).get();

  return filesSnapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as MovieCreativeFileRecord) }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function updateCreativeFile(args: {
  jobId: string;
  fileKey: string;
  content: string;
}) {
  const db = getDb();
  const { movieCreativeFiles } = getCollections(db);
  const docId = creativeFileDocId(args.jobId, args.fileKey);
  const ref = movieCreativeFiles.doc(docId);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new Error(`File not found for key '${args.fileKey}'.`);
  }

  const file = snapshot.data() as MovieCreativeFileRecord;
  await ref.set(
    {
      content: args.content,
      revision: file.revision + 1,
      updatedBy: "user",
      updatedAt: Date.now(),
    },
    { merge: true },
  );

  return { ok: true };
}

export async function completeJobFromRenderWebhook(args: CompleteWebhookInput) {
  const db = getDb();
  const { jobs } = getCollections(db);
  const snapshot = await jobs.where("renderJobId", "==", args.renderJobId).limit(1).get();

  if (snapshot.empty) {
    return { ok: false, message: "No job found for render id." };
  }

  const jobDoc = snapshot.docs[0];
  const job = jobDoc.data() as JobRecord;
  const now = Date.now();

  const patch: Partial<JobRecord> = {
    updatedAt: now,
    providerMeta: args.providerMeta ?? job.providerMeta,
  };

  if (args.status === "done") {
    patch.status = "completed";
    patch.stage = "completed";
    patch.progress = 100;
    patch.message = "Render completed.";
    patch.completedAt = now;
    patch.finalVideoUrl = args.finalVideoUrl ?? job.finalVideoUrl;
  } else if (args.status === "failed") {
    patch.status = "failed";
    patch.stage = "failed";
    patch.message = args.error || "Render failed.";
    patch.error = args.error;
  } else {
    patch.status = "generating";
    patch.stage = "assembly";
    patch.message = "Render is in progress.";
  }

  await jobDoc.ref.set(compactObject(patch as Record<string, unknown>), {
    merge: true,
  });

  return { ok: true };
}

export async function startProductionStep(jobId: string) {
  const db = getDb();
  const { jobs } = getCollections(db);
  const jobRef = jobs.doc(jobId);
  const snapshot = await jobRef.get();

  if (!snapshot.exists) {
    throw new Error("Job not found.");
  }

  const job = snapshot.data() as JobRecord;
  if (job.stage !== "production_pending" && job.stage !== "completed") {
    throw new Error("Step 1 is not complete yet. Finish pre-production first.");
  }

  const now = Date.now();
  await jobRef.set(
    compactObject({
      status: "generating",
      stage: "production",
      progress: 0,
      message: "Step 2 production triggered.",
      updatedAt: now,
      error: undefined,
    }),
    { merge: true },
  );

  return { ok: true };
}

export async function runOpencodeJob(jobId: string) {
  await updateJobState({
    jobId,
    status: "generating",
    stage: "pre_production",
    progress: 3,
    message: "OpenCode agent started Step 1 (pre-production).",
  });

  const systemPrompt = [
    "You are OpenCode running inside a Firebase film workflow.",
    "Workflow has two steps:",
    "1) pre-production (active now)",
    "2) production (not active yet)",
    "In this run, work ONLY on Step 1 pre-production.",
    "Return ONLY valid JSON with this shape:",
    "{",
    '  "stage": "pre_production|production_pending",',
    '  "progress": 0-100,',
    '  "message": "short status",',
    '  "done": boolean,',
    `  "doneToken": "Use ${DEFAULT_DONE_TOKEN} only when done",`,
    '  "updates": [{ "fileKey": "title|concept|plot_overview|visual_style|script|storyboard_text", "title": "optional", "content": "full markdown replacement text" }]',
    "}",
    "Rules:",
    "1) Update at least one file each turn unless done=true.",
    "2) Every file is a .md document and may be edited in any turn.",
    "3) Preserve markdown structure and rewrite full document when improving.",
    "4) done=true only after all Step 1 documents are complete and coherent: title, concept, plot_overview, visual_style, script, storyboard_text.",
    `5) When done=true, doneToken must be exactly ${DEFAULT_DONE_TOKEN}.`,
  ].join("\n");

  let sessionId: string | null = null;

  try {
    sessionId = await createOpencodeSession();

    for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration += 1) {
      const context = await getOpencodeContext(jobId);
      if (!context) {
        throw new Error("Missing job context.");
      }

      const userPrompt = JSON.stringify(
        {
          task: "Improve the movie planning files.",
          iteration,
          maxIterations: MAX_ITERATIONS,
          movie: {
            title: context.movie.title,
            concept: context.movie.concept,
          },
          files: mapFilesForPrompt(context.files),
        },
        null,
        2,
      );

      const model = await callOpencodeMessage({
        sessionId,
        systemPrompt,
        userPrompt,
      });

      const updates = (model.updates ?? [])
        .slice(0, MAX_FILES_PER_TURN)
        .filter(
          (update): update is OpencodeUpdate =>
            typeof update?.fileKey === "string" &&
            typeof update?.content === "string" &&
            normalizeText(update.content).length > 0,
        );

      if (updates.length > 0) {
        await applyOpencodeUpdates({
          jobId,
          movieId: context.movieId,
          updates,
        });
      }

      await syncMovieFromCreativeFiles(jobId);

      const refreshedContext = await getOpencodeContext(jobId);
      if (!refreshedContext) {
        throw new Error("Missing job context after updates.");
      }

      const doneByModel = model.done === true;
      const doneByFiles = hasCoreFilesCompleted(refreshedContext.files);
      const hasDoneToken = normalizeText(model.doneToken) === DEFAULT_DONE_TOKEN;
      const done = doneByModel && doneByFiles && hasDoneToken;

      const progress = done
        ? 100
        : clampProgress(model.progress, defaultProgressForIteration(iteration));
      const stage = done ? "production_pending" : stageFromModel(model.stage);
      const message =
        normalizeText(model.message) ||
        (done
          ? `Step 1 complete. Ready for Step 2 production.`
          : doneByModel && doneByFiles && !hasDoneToken
            ? `OpenCode requested completion but missing required token ${DEFAULT_DONE_TOKEN}.`
            : `OpenCode Step 1 iteration ${iteration}/${MAX_ITERATIONS} finished.`);

      await updateJobState({
        jobId,
        status: done ? "completed" : "generating",
        stage,
        progress,
        message,
        completionToken: done
          ? normalizeText(model.doneToken) || DEFAULT_DONE_TOKEN
          : undefined,
      });

        if (done) {
        return {
          ok: true,
          completionToken: normalizeText(model.doneToken) || DEFAULT_DONE_TOKEN,
          nextStep: "production",
        };
      }
    }

    await updateJobState({
      jobId,
      status: "failed",
      stage: "failed",
      progress: 100,
      message: "OpenCode Step 1 stopped before completing required files.",
      error: "MAX_ITERATIONS_REACHED",
    });

    return {
      ok: false,
      error: "MAX_ITERATIONS_REACHED",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown opencode error.";
    await updateJobState({
      jobId,
      status: "failed",
      stage: "failed",
      progress: 100,
      message: "Opencode failed.",
      error: message,
    });

    return {
      ok: false,
      error: message,
    };
  } finally {
    if (sessionId) {
      try {
        await closeOpencodeSession(sessionId);
      } catch {
        // Non-blocking cleanup path.
      }
    }
  }
}
