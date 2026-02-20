import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { completeJobFromRenderWebhook } from "@/lib/movie-jobs";

export const runtime = "nodejs";

function constantTimeEquals(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

function readHeader(headers: Headers, names: string[]): string | null {
  for (const name of names) {
    const value = headers.get(name);
    if (value) {
      return value;
    }
  }

  return null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function mapStatus(rawStatus: string | undefined): "queued" | "rendering" | "done" | "failed" {
  const normalized = rawStatus?.toLowerCase() ?? "";

  if (normalized.includes("done") || normalized.includes("complete")) {
    return "done";
  }

  if (normalized.includes("fail") || normalized.includes("error")) {
    return "failed";
  }

  if (normalized.includes("render") || normalized.includes("process")) {
    return "rendering";
  }

  return "queued";
}

export async function POST(request: Request) {
  const webhookSecret = process.env.SHOTSTACK_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Missing SHOTSTACK_WEBHOOK_SECRET" },
      { status: 500 },
    );
  }

  const providedSecret = readHeader(request.headers, [
    "x-webhook-secret",
    "x-shotstack-signature",
    "authorization",
  ]);

  const normalizedSecret =
    providedSecret?.startsWith("Bearer ") === true
      ? providedSecret.slice("Bearer ".length)
      : providedSecret;

  if (!normalizedSecret || !constantTimeEquals(normalizedSecret, webhookSecret)) {
    return NextResponse.json({ error: "Unauthorized webhook" }, { status: 401 });
  }

  const payload = (await request.json()) as Record<string, unknown>;

  const renderJobId =
    asString(payload.id) ||
    asString(payload.renderId) ||
    asString((payload.response as Record<string, unknown> | undefined)?.id);

  if (!renderJobId) {
    return NextResponse.json(
      { error: "Webhook payload missing render id" },
      { status: 400 },
    );
  }

  const rawStatus =
    asString(payload.status) ||
    asString((payload.response as Record<string, unknown> | undefined)?.status) ||
    asString((payload.data as Record<string, unknown> | undefined)?.status);

  const finalVideoUrl =
    asString(payload.url) ||
    asString((payload.response as Record<string, unknown> | undefined)?.url) ||
    asString((payload.data as Record<string, unknown> | undefined)?.url);

  const providerError =
    asString(payload.error) ||
    asString((payload.data as Record<string, unknown> | undefined)?.error);

  const result = await completeJobFromRenderWebhook({
    renderJobId,
    status: mapStatus(rawStatus),
    finalVideoUrl,
    error: providerError,
    providerMeta: {
      webhookStatus: rawStatus,
      webhookPayloadId: asString(payload.id),
    },
  });

  return NextResponse.json({ ok: true, result });
}
