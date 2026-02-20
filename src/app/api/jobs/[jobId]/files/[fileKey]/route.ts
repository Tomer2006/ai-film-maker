import { NextResponse } from "next/server";

import { updateCreativeFile } from "@/lib/movie-jobs";

export const runtime = "nodejs";

function asOptionalString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ jobId: string; fileKey: string }> },
) {
  try {
    const { jobId, fileKey } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const content = asOptionalString(body.content);

    await updateCreativeFile({ jobId, fileKey, content });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update file.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
