import { NextResponse } from "next/server";

import { previewQrGenerateCredits } from "@/lib/quick-replica/qr-credits-preview";
import { parseQrWorkspaceDraft } from "@/lib/quick-replica/parse-qr-workspace-draft";
import { requireQuickReplicaUser } from "@/lib/quick-replica/qr-platform-auth";

export const dynamic = "force-dynamic";

/** 快速复制 · 生成前积分预览（draft 与 jobs/generate 同构）。 */
export async function POST(request: Request) {
  const auth = await requireQuickReplicaUser(request);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const draft = parseQrWorkspaceDraft(body);
  if (!draft) {
    return NextResponse.json({ error: "category/kind 必填" }, { status: 400 });
  }

  const preview = await previewQrGenerateCredits(auth.userId, draft);
  return NextResponse.json(preview);
}
