import { NextResponse } from "next/server";

import { listCreativeFiles } from "@/lib/movie-jobs";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await context.params;
    const files = await listCreativeFiles(jobId);
    return NextResponse.json({ files });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list creative files.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
