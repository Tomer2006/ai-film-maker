import { NextResponse } from "next/server";

import { startProductionStep } from "@/lib/movie-jobs";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await context.params;
    const result = await startProductionStep(jobId);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start production.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
