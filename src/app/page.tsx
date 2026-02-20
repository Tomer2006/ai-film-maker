"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type StepId = "title" | "concept" | "plotOverview" | "script" | "visualStyle";
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

type Step = {
  id: StepId;
  label: string;
  prompt: string;
  placeholder: string;
  rows: number;
};

const steps: Step[] = [
  {
    id: "title",
    label: "Title",
    prompt: "What is your movie called?",
    placeholder: "Type your movie title...",
    rows: 2,
  },
  {
    id: "concept",
    label: "Concept",
    prompt: "Describe the core concept in one or two sentences.",
    placeholder:
      "Example: A retired astronaut trains a crew of teenagers to stop a lunar mining war.",
    rows: 4,
  },
  {
    id: "plotOverview",
    label: "Plot Overview",
    prompt: "Give a high-level overview of the plot.",
    placeholder: "Beginning, major turning points, and ending...",
    rows: 5,
  },
  {
    id: "script",
    label: "Script",
    prompt: "Add script notes or an initial script draft.",
    placeholder: "Scene ideas, dialogue snippets, or structure...",
    rows: 7,
  },
  {
    id: "visualStyle",
    label: "Visual Style",
    prompt: "Describe the visual style.",
    placeholder: "Realism, anime...",
    rows: 6,
  },
];

const emptyAnswers: Record<StepId, string> = {
  title: "",
  concept: "",
  plotOverview: "",
  script: "",
  visualStyle: "",
};

type Job = {
  id: string;
  status: JobStatus;
  stage?: JobStage;
  progress: number;
  message: string;
  totalScenes?: number;
  completedScenes?: number;
  finalVideoUrl?: string;
  error?: string;
  movieTitle: string;
  createdAt: number;
};

type CreativeFile = {
  id: string;
  jobId: string;
  movieId: string;
  fileKey: string;
  title: string;
  fileName: string;
  sortOrder: number;
  content: string;
  revision: number;
  updatedBy: "system" | "opencode" | "user";
  createdAt: number;
  updatedAt: number;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const DEMO_USER_ID = "demo-user";
const PRE_PRODUCTION_FILE_ORDER = [
  "title",
  "concept",
  "plot_overview",
  "visual_style",
  "script",
  "storyboard_text",
] as const;
const PRE_PRODUCTION_SET = new Set<string>(PRE_PRODUCTION_FILE_ORDER);

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (!response.ok) {
    const message =
      typeof payload.error === "string"
        ? payload.error
        : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}

export default function Home() {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<StepId, string>>(emptyAnswers);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isSubmittingJob, setIsSubmittingJob] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [creativeFiles, setCreativeFiles] = useState<CreativeFile[]>([]);
  const [selectedFileKey, setSelectedFileKey] = useState<string | null>(null);
  const [draftByKey, setDraftByKey] = useState<Record<string, string>>({});
  const [saveStateByKey, setSaveStateByKey] = useState<Record<string, SaveState>>(
    {},
  );
  const [filesError, setFilesError] = useState<string | null>(null);
  const [isStartingProduction, setIsStartingProduction] = useState(false);
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const dirtyByKeyRef = useRef<Record<string, boolean>>({});

  const isReview = stepIndex >= steps.length;
  const currentStep = steps[stepIndex];
  const currentValue = currentStep ? answers[currentStep.id] : "";
  const progress = useMemo(
    () => Math.round((Math.min(stepIndex, steps.length) / steps.length) * 100),
    [stepIndex],
  );
  const preProductionFiles = useMemo(() => {
    const order: Record<string, number> = {};
    PRE_PRODUCTION_FILE_ORDER.forEach((key, index) => {
      order[key] = index;
    });

    return creativeFiles
      .filter((file) => PRE_PRODUCTION_SET.has(file.fileKey))
      .sort((a, b) => (order[a.fileKey] ?? 999) - (order[b.fileKey] ?? 999));
  }, [creativeFiles]);
  const selectedFile = useMemo(
    () => preProductionFiles.find((file) => file.fileKey === selectedFileKey) ?? null,
    [preProductionFiles, selectedFileKey],
  );

  const loadJobs = useCallback(async () => {
    try {
      const result = await fetchJson<{ jobs: Job[] }>(
        `/api/jobs?userId=${encodeURIComponent(DEMO_USER_ID)}`,
      );
      setJobs(result.jobs);
      setJobsError(null);
    } catch (error) {
      setJobsError(
        error instanceof Error ? error.message : "Failed to load jobs.",
      );
    }
  }, []);

  const loadActiveJob = useCallback(async (jobId: string) => {
    try {
      const result = await fetchJson<{ job: Job | null }>(`/api/jobs/${jobId}`);
      setActiveJob(result.job);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to load active job.",
      );
    }
  }, []);

  const loadCreativeFiles = useCallback(async (jobId: string) => {
    try {
      const result = await fetchJson<{ files: CreativeFile[] }>(
        `/api/jobs/${jobId}/files`,
      );
      const files = result.files.filter((file) =>
        PRE_PRODUCTION_SET.has(file.fileKey),
      );

      setCreativeFiles(files);
      setFilesError(null);
      setSelectedFileKey((prev) => {
        if (prev && files.some((file) => file.fileKey === prev)) {
          return prev;
        }
        return files[0]?.fileKey ?? null;
      });

      setDraftByKey((prev) => {
        const next: Record<string, string> = {};
        for (const file of files) {
          if (dirtyByKeyRef.current[file.fileKey]) {
            next[file.fileKey] = prev[file.fileKey] ?? file.content;
          } else {
            next[file.fileKey] = file.content;
          }
        }
        return next;
      });
    } catch (error) {
      setFilesError(
        error instanceof Error ? error.message : "Failed to load documents.",
      );
    }
  }, []);

  const saveFile = useCallback(
    async (fileKey: string, content: string) => {
      if (!activeJobId) return;

      setSaveStateByKey((prev) => ({ ...prev, [fileKey]: "saving" }));
      try {
        await fetchJson<{ ok: true }>(`/api/jobs/${activeJobId}/files/${fileKey}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content }),
        });

        dirtyByKeyRef.current[fileKey] = false;
        setSaveStateByKey((prev) => ({ ...prev, [fileKey]: "saved" }));
        setCreativeFiles((prev) =>
          prev.map((file) =>
            file.fileKey === fileKey
              ? {
                  ...file,
                  content,
                  revision: file.revision + 1,
                  updatedBy: "user",
                  updatedAt: Date.now(),
                }
              : file,
          ),
        );
      } catch {
        setSaveStateByKey((prev) => ({ ...prev, [fileKey]: "error" }));
      }
    },
    [activeJobId],
  );

  const startProductionStep = useCallback(async () => {
    if (!activeJobId) return;

    setIsStartingProduction(true);
    setSubmitError(null);

    try {
      await fetchJson<{ ok: true }>(`/api/jobs/${activeJobId}/start-production`, {
        method: "POST",
      });
      await loadActiveJob(activeJobId);
      await loadJobs();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to start Step 2 production.",
      );
    } finally {
      setIsStartingProduction(false);
    }
  }, [activeJobId, loadActiveJob, loadJobs]);

  useEffect(() => {
    void loadJobs();
    const timer = setInterval(() => {
      void loadJobs();
    }, 5000);

    return () => clearInterval(timer);
  }, [loadJobs]);

  useEffect(() => {
    if (!activeJobId) {
      setActiveJob(null);
      return;
    }

    void loadActiveJob(activeJobId);
    const timer = setInterval(() => {
      void loadActiveJob(activeJobId);
    }, 2000);

    return () => clearInterval(timer);
  }, [activeJobId, loadActiveJob]);

  useEffect(() => {
    for (const timer of Object.values(saveTimersRef.current)) {
      clearTimeout(timer);
    }
    saveTimersRef.current = {};
    dirtyByKeyRef.current = {};

    if (!activeJobId) {
      setCreativeFiles([]);
      setSelectedFileKey(null);
      setDraftByKey({});
      setSaveStateByKey({});
      return;
    }

    void loadCreativeFiles(activeJobId);
    const timer = setInterval(() => {
      void loadCreativeFiles(activeJobId);
    }, 4000);

    return () => clearInterval(timer);
  }, [activeJobId, loadCreativeFiles]);

  useEffect(() => {
    const saveTimers = saveTimersRef.current;
    return () => {
      for (const timer of Object.values(saveTimers)) {
        clearTimeout(timer);
      }
    };
  }, []);

  function updateAnswer(value: string) {
    if (!currentStep) return;
    setAnswers((prev) => ({ ...prev, [currentStep.id]: value }));
  }

  function goNext() {
    setStepIndex((prev) => Math.min(prev + 1, steps.length));
  }

  function onSkip() {
    goNext();
  }

  function onContinue() {
    if (!currentValue.trim()) return;
    goNext();
  }

  function restart() {
    setAnswers(emptyAnswers);
    setStepIndex(0);
  }

  function onEditSelectedFile(value: string) {
    if (!selectedFileKey) return;

    dirtyByKeyRef.current[selectedFileKey] = true;
    setDraftByKey((prev) => ({ ...prev, [selectedFileKey]: value }));
    setSaveStateByKey((prev) => ({ ...prev, [selectedFileKey]: "saving" }));

    const existingTimer = saveTimersRef.current[selectedFileKey];
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    saveTimersRef.current[selectedFileKey] = setTimeout(() => {
      void saveFile(selectedFileKey, value);
    }, 900);
  }

  function saveLabel(fileKey: string): string {
    const saveState = saveStateByKey[fileKey] ?? "idle";
    if (saveState === "saving") return "Saving...";
    if (saveState === "saved") return "Saved";
    if (saveState === "error") return "Save failed";
    if (dirtyByKeyRef.current[fileKey]) return "Unsaved changes";
    return "Idle";
  }

  async function startMovieProduction() {
    setSubmitError(null);
    setIsSubmittingJob(true);

    try {
      const result = await fetchJson<{ jobId: string }>("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: DEMO_USER_ID,
          title: answers.title,
          concept: answers.concept,
          plotOverview: answers.plotOverview,
          script: answers.script,
          visualStyle: answers.visualStyle,
        }),
      });

      setActiveJobId(result.jobId);
      await loadJobs();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Failed to start movie generation.",
      );
    } finally {
      setIsSubmittingJob(false);
    }
  }

  function statusClasses(status: JobStatus) {
    if (status === "completed") return "border-emerald-400/40 text-emerald-200";
    if (status === "failed") return "border-red-400/40 text-red-200";
    if (status === "generating") return "border-cyan-400/40 text-cyan-200";
    return "border-slate-500/40 text-slate-200";
  }

  function statusLabel(status: JobStatus) {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  function stageLabel(stage?: JobStage) {
    if (!stage) return "Queued";
    if (stage === "pre_production") return "Step 1: Pre-production";
    if (stage === "production_pending") return "Step 2 pending";
    if (stage === "production") return "Step 2: Production";
    if (stage === "idea") return "Idea";
    if (stage === "story") return "Story";
    if (stage === "screenplay") return "Screenplay";
    if (stage === "scene_plan") return "Scene plan";
    if (stage === "scene_generation") return "Scene generation";
    return stage.charAt(0).toUpperCase() + stage.slice(1);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_15%_15%,#1d4ed8_0%,transparent_35%),radial-gradient(circle_at_85%_20%,#7c2d12_0%,transparent_35%),linear-gradient(180deg,#020617_0%,#0f172a_55%,#1e1b4b_100%)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -top-28 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#f59e0b]/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full bg-[#38bdf8]/15 blur-3xl" />

      <main className="mx-auto w-full max-w-3xl rounded-3xl border border-white/10 bg-[#0b1120]/80 p-6 shadow-[0_20px_70px_-30px_rgba(0,0,0,0.9)] backdrop-blur md:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7dd3fc]">
              AI Movie Maker
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#f8fafc] md:text-3xl">
              Build Your Film Blueprint
            </h1>
          </div>
          <p className="rounded-full border border-[#334155] bg-[#0f172a] px-3 py-1 text-xs font-semibold text-[#a5f3fc]">
            Firebase wired
          </p>
        </div>

        {!isReview && (
          <div className="mb-8">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.12em] text-[#94a3b8]">
              <span>{`Question ${stepIndex + 1} of ${steps.length}`}</span>
              <span>{progress}% complete</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#1e293b]">
              <div
                className="h-full bg-[linear-gradient(90deg,#38bdf8_0%,#fb923c_100%)] transition-all duration-500"
                style={{ width: `${Math.max(progress, 5)}%` }}
              />
            </div>
          </div>
        )}

        {!isReview && currentStep && (
          <section className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-semibold text-[#cbd5e1]">
                {currentStep.label}
              </p>
              <h2 className="text-xl font-semibold leading-tight text-[#f8fafc] md:text-2xl">
                {currentStep.prompt}
              </h2>
            </div>

            <textarea
              className="w-full resize-y rounded-2xl border border-[#334155] bg-[#0f172a] px-4 py-3 text-base text-[#e2e8f0] outline-none transition placeholder:text-[#64748b] focus:border-[#38bdf8] focus:ring-4 focus:ring-[#0c4a6e]/50"
              placeholder={currentStep.placeholder}
              rows={currentStep.rows}
              value={currentValue}
              onChange={(event) => updateAnswer(event.target.value)}
            />

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onSkip}
                className="rounded-xl border border-[#475569] px-5 py-2.5 text-sm font-semibold text-[#cbd5e1] transition hover:border-[#94a3b8] hover:bg-[#1e293b]"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={onContinue}
                disabled={!currentValue.trim()}
                className="rounded-xl bg-[#0284c7] px-5 py-2.5 text-sm font-semibold text-[#e0f2fe] transition hover:bg-[#0369a1] disabled:cursor-not-allowed disabled:bg-[#334155] disabled:text-[#94a3b8]"
              >
                Continue
              </button>
            </div>
          </section>
        )}

        {isReview && (
          <section className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7dd3fc]">
                Ready
              </p>
              <h2 className="mt-2 text-2xl font-bold text-[#f8fafc] md:text-3xl">
                Movie setup complete
              </h2>
              <p className="mt-2 text-sm text-[#94a3b8]">
                You can review everything here. Skipped sections are marked for
                later.
              </p>
            </div>

            <div className="grid gap-3">
              {steps.map((step) => {
                const value = answers[step.id].trim();

                return (
                  <div
                    key={step.id}
                    className="rounded-2xl border border-[#334155] bg-[#0f172a] p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
                      {step.label}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-[#e2e8f0]">
                      {value || "Skipped for now"}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setStepIndex(0)}
                className="rounded-xl border border-[#475569] px-5 py-2.5 text-sm font-semibold text-[#cbd5e1] transition hover:border-[#94a3b8] hover:bg-[#1e293b]"
              >
                Edit Answers
              </button>
              <button
                type="button"
                onClick={restart}
                className="rounded-xl border border-[#475569] px-5 py-2.5 text-sm font-semibold text-[#cbd5e1] transition hover:border-[#94a3b8] hover:bg-[#1e293b]"
              >
                Clear Form
              </button>
              <button
                type="button"
                onClick={startMovieProduction}
                disabled={isSubmittingJob}
                className="rounded-xl bg-[#0284c7] px-5 py-2.5 text-sm font-semibold text-[#e0f2fe] transition hover:bg-[#0369a1] disabled:cursor-not-allowed disabled:bg-[#334155] disabled:text-[#94a3b8]"
              >
                {isSubmittingJob ? "Starting..." : "Start movie production"}
              </button>
            </div>

            {submitError && (
              <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-200">
                {submitError}
              </div>
            )}

            {activeJobId && (
              <div className="space-y-4 rounded-2xl border border-[#334155] bg-[#0f172a] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#e2e8f0]">
                    Step 1 docs (.md)
                  </p>
                  {activeJob?.stage === "production_pending" && (
                    <button
                      type="button"
                      onClick={startProductionStep}
                      disabled={isStartingProduction}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-[#334155] disabled:text-[#94a3b8]"
                    >
                      {isStartingProduction
                        ? "Starting Step 2..."
                        : "Start Step 2 production"}
                    </button>
                  )}
                </div>

                {filesError && (
                  <p className="text-sm text-red-200">{filesError}</p>
                )}

                {preProductionFiles.length > 0 && (
                  <div className="grid gap-4 md:grid-cols-[220px,1fr]">
                    <div className="space-y-2">
                      {preProductionFiles.map((file) => (
                        <button
                          key={file.fileKey}
                          type="button"
                          onClick={() => setSelectedFileKey(file.fileKey)}
                          className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                            selectedFileKey === file.fileKey
                              ? "border-cyan-400/50 bg-cyan-900/20"
                              : "border-[#334155] bg-[#020617] hover:border-[#475569]"
                          }`}
                        >
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#94a3b8]">
                            {file.title}
                          </p>
                          <p className="mt-1 text-xs text-[#64748b]">
                            {file.fileName}
                          </p>
                          <p className="mt-1 text-xs text-[#94a3b8]">
                            {saveLabel(file.fileKey)}
                          </p>
                        </button>
                      ))}
                    </div>

                    {selectedFile && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-[#94a3b8]">
                            {selectedFile.fileName}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              void saveFile(
                                selectedFile.fileKey,
                                draftByKey[selectedFile.fileKey] ??
                                  selectedFile.content,
                              )
                            }
                            className="rounded-lg border border-[#475569] px-3 py-1 text-xs font-semibold text-[#cbd5e1] transition hover:border-[#94a3b8] hover:bg-[#1e293b]"
                          >
                            Save now
                          </button>
                        </div>
                        <textarea
                          className="min-h-[320px] w-full resize-y rounded-2xl border border-[#334155] bg-[#020617] px-4 py-3 font-mono text-sm text-[#e2e8f0] outline-none transition placeholder:text-[#64748b] focus:border-[#38bdf8] focus:ring-4 focus:ring-[#0c4a6e]/50"
                          value={
                            draftByKey[selectedFile.fileKey] ?? selectedFile.content
                          }
                          onChange={(event) => onEditSelectedFile(event.target.value)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeJob && (
              <div className="space-y-4 rounded-2xl border border-[#334155] bg-[#0f172a] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#e2e8f0]">
                    Live job status
                  </p>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(activeJob.status)}`}
                  >
                    {statusLabel(activeJob.status)}
                  </span>
                </div>

                <p className="text-sm text-[#94a3b8]">{activeJob.message}</p>
                <p className="text-xs text-[#94a3b8]">
                  Stage: {stageLabel(activeJob.stage)}
                  {typeof activeJob.completedScenes === "number" &&
                    typeof activeJob.totalScenes === "number" &&
                    ` (${activeJob.completedScenes}/${activeJob.totalScenes})`}
                </p>

                <div className="h-2 overflow-hidden rounded-full bg-[#1e293b]">
                  <div
                    className="h-full bg-[linear-gradient(90deg,#38bdf8_0%,#fb923c_100%)] transition-all duration-500"
                    style={{ width: `${Math.max(activeJob.progress, 4)}%` }}
                  />
                </div>

                {activeJob.finalVideoUrl && (
                  <a
                    href={activeJob.finalVideoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-500"
                  >
                    Watch final movie
                  </a>
                )}
              </div>
            )}

            <div className="space-y-3 rounded-2xl border border-[#334155] bg-[#0f172a] p-4">
              <p className="text-sm font-semibold text-[#e2e8f0]">Job history</p>

              {jobsError && (
                <p className="text-sm text-red-200">{jobsError}</p>
              )}

              {jobs.length === 0 && !jobsError && (
                <p className="text-sm text-[#94a3b8]">
                  No jobs yet. Start your first generation.
                </p>
              )}

              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex flex-col gap-2 rounded-xl border border-[#334155] bg-[#020617] p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#e2e8f0]">
                      {job.movieTitle}
                    </p>
                    <p className="text-xs text-[#94a3b8]">
                      {new Date(job.createdAt).toLocaleString()}
                    </p>
                    <p className="text-xs text-[#94a3b8]">
                      Stage: {stageLabel(job.stage)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(job.status)}`}
                    >
                      {statusLabel(job.status)}
                    </span>
                    {job.finalVideoUrl && (
                      <a
                        href={job.finalVideoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-emerald-500/40 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/10"
                      >
                        Open
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
