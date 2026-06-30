import { NextResponse } from "next/server";

import { qrCreateMotionSyncJob } from "@/lib/quick-replica/qr-motion-sync-service";
import { requireQuickReplicaUser } from "@/lib/quick-replica/qr-platform-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireQuickReplicaUser(request);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const targetImageUrl =
    typeof body.targetImageUrl === "string" ? body.targetImageUrl.trim() : "";
  const referenceVideoUrl =
    typeof body.referenceVideoUrl === "string" ? body.referenceVideoUrl.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const modelKey =
    typeof body.modelKey === "string" && body.modelKey.trim()
      ? body.modelKey.trim()
      : "kling-2.6/motion-control";
  const mode = typeof body.mode === "string" ? body.mode : undefined;
  const characterOrientation =
    typeof body.characterOrientation === "string"
      ? body.characterOrientation
      : undefined;

  if (!targetImageUrl || !referenceVideoUrl) {
    return NextResponse.json({ error: "targetImageUrl 与 referenceVideoUrl 必填" }, { status: 400 });
  }

  try {
    const result = await qrCreateMotionSyncJob(auth.userId, {
      targetImageUrl,
      referenceVideoUrl,
      prompt,
      modelKey,
      mode,
      characterOrientation,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "创建任务失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
