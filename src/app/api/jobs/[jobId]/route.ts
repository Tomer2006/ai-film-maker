import { NextResponse } from "next/server";

import { getJob } from "@/lib/movie-jobs";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await context.params;
    const job = await getJob(jobId);
    return NextResponse.json({ job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get job.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
