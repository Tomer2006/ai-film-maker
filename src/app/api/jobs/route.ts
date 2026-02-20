import { after, NextResponse } from "next/server";

import { createMovieAndQueueJob, listJobsByUser, runOpencodeJob } from "@/lib/movie-jobs";

export const runtime = "nodejs";

function asOptionalString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId")?.trim();

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  try {
    const jobs = await listJobsByUser(userId);
    return NextResponse.json({ jobs });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list jobs.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const userId = asOptionalString(body.userId).trim();

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const jobId = await createMovieAndQueueJob({
      userId,
      title: asOptionalString(body.title),
      concept: asOptionalString(body.concept),
      plotOverview: asOptionalString(body.plotOverview),
      script: asOptionalString(body.script),
      visualStyle: asOptionalString(body.visualStyle),
    });

    after(async () => {
      try {
        await runOpencodeJob(jobId);
      } catch (error) {
        console.error("runOpencodeJob failed", error);
      }
    });
    return NextResponse.json({ jobId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create job.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
