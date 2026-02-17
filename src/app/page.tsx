"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";

type StepId = "title" | "concept" | "plotOverview" | "script" | "visualStyle";
type JobStatus = "queued" | "generating" | "completed" | "failed";

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
    placeholder: "Example: A retired astronaut trains a crew of teenagers to stop a lunar mining war.",
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

type QueryRef = FunctionReference<"query">;
type MutationRef = FunctionReference<"mutation">;

type Job = {
  _id: string;
  status: JobStatus;
  progress: number;
  message: string;
  finalVideoUrl?: string;
  error?: string;
  movieTitle: string;
  createdAt: number;
};

const DEMO_USER_ID = "demo-user";
const createMovieAndStartJobRef =
  "movies:createMovieAndStartJob" as unknown as MutationRef;
const listJobsByUserRef = "movies:listJobsByUser" as unknown as QueryRef;
const getJobRef = "movies:getJob" as unknown as QueryRef;

export default function Home() {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<StepId, string>>(emptyAnswers);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isSubmittingJob, setIsSubmittingJob] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const createMovieAndStartJob = useMutation(createMovieAndStartJobRef);
  const jobs = (useQuery(listJobsByUserRef, {
    userId: DEMO_USER_ID,
  }) as Job[] | undefined) ?? [];
  const activeJob = (useQuery(
    getJobRef,
    activeJobId ? { jobId: activeJobId } : "skip",
  ) as Job | null | undefined) ?? null;
  const convexConfigured = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

  const isReview = stepIndex >= steps.length;
  const currentStep = steps[stepIndex];
  const currentValue = currentStep ? answers[currentStep.id] : "";
  const progress = useMemo(
    () => Math.round((Math.min(stepIndex, steps.length) / steps.length) * 100),
    [stepIndex],
  );

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

  async function startMovieProduction() {
    if (!convexConfigured) {
      setSubmitError(
        "Set NEXT_PUBLIC_CONVEX_URL in your environment before starting a movie job.",
      );
      return;
    }

    setSubmitError(null);
    setIsSubmittingJob(true);

    try {
      const jobId = (await createMovieAndStartJob({
        userId: DEMO_USER_ID,
        title: answers.title,
        concept: answers.concept,
        plotOverview: answers.plotOverview,
        script: answers.script,
        visualStyle: answers.visualStyle,
      })) as string;

      setActiveJobId(jobId);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to start movie generation.",
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
            Convex wired
          </p>
        </div>

        {!convexConfigured && (
          <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-950/30 p-4 text-sm text-amber-100">
            Convex is not configured. Add <code>NEXT_PUBLIC_CONVEX_URL</code> to
            your environment.
          </div>
        )}

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
                You can review everything here. Skipped sections are marked for later.
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
                disabled={isSubmittingJob || !convexConfigured}
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

            {activeJob && (
              <div className="space-y-4 rounded-2xl border border-[#334155] bg-[#0f172a] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#e2e8f0]">Live job status</p>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(activeJob.status)}`}
                  >
                    {statusLabel(activeJob.status)}
                  </span>
                </div>

                <p className="text-sm text-[#94a3b8]">{activeJob.message}</p>

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

              {jobs.length === 0 && (
                <p className="text-sm text-[#94a3b8]">No jobs yet. Start your first generation.</p>
              )}

              {jobs.map((job) => (
                <div
                  key={job._id}
                  className="flex flex-col gap-2 rounded-xl border border-[#334155] bg-[#020617] p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#e2e8f0]">{job.movieTitle}</p>
                    <p className="text-xs text-[#94a3b8]">
                      {new Date(job.createdAt).toLocaleString()}
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
