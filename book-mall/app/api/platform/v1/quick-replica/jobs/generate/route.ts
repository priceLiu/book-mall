import { NextResponse } from "next/server";

import { qrCreateGenerateJob } from "@/lib/quick-replica/qr-generate-service";
import { parseQrWorkspaceDraft } from "@/lib/quick-replica/parse-qr-workspace-draft";
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

  const draft = parseQrWorkspaceDraft(body);
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
