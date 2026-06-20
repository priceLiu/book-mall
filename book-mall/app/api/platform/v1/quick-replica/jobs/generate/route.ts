import { NextResponse } from "next/server";

import { qrCreateGenerateJob } from "@/lib/quick-replica/qr-generate-service";
import { requireQuickReplicaUser } from "@/lib/quick-replica/qr-platform-auth";
import type { QrCategory, QrWorkspaceDraft } from "@/lib/quick-replica/qr-types";

export const dynamic = "force-dynamic";

function parseCategory(raw: unknown): QrCategory | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim() as QrCategory;
  if (v === "video" || v === "image" || v === "character" || v === "world" || v === "audio") {
    return v;
  }
  return null;
}

function parseDraft(body: Record<string, unknown>): QrWorkspaceDraft | null {
  const category = parseCategory(body.category);
  const kind = typeof body.kind === "string" ? body.kind.trim() : "";
  if (!category || !kind) return null;
  const modelKey =
    typeof body.modelKey === "string" && body.modelKey.trim()
      ? body.modelKey.trim()
      : "lib-nano-pro";
  return {
    category,
    kind,
    toolKey: typeof body.toolKey === "string" ? body.toolKey : undefined,
    title: typeof body.title === "string" ? body.title : undefined,
    targetImageUrl: typeof body.targetImageUrl === "string" ? body.targetImageUrl : "",
    referenceVideoUrl:
      typeof body.referenceVideoUrl === "string" ? body.referenceVideoUrl : "",
    referenceAudioUrl:
      typeof body.referenceAudioUrl === "string" ? body.referenceAudioUrl : "",
    sceneImageUrls: Array.isArray(body.sceneImageUrls)
      ? body.sceneImageUrls.filter((u): u is string => typeof u === "string")
      : [],
    prompt: typeof body.prompt === "string" ? body.prompt : "",
    modelKey,
    mode: typeof body.mode === "string" ? body.mode : undefined,
  };
}

export async function POST(request: Request) {
  const auth = await requireQuickReplicaUser(request);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const draft = parseDraft(body);
  if (!draft) {
    return NextResponse.json({ error: "category/kind 必填" }, { status: 400 });
  }

  try {
    const job = await qrCreateGenerateJob(auth.userId, draft);
    return NextResponse.json(job, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "创建任务失败";
    const status =
      e instanceof Error && message.includes("Gateway") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
