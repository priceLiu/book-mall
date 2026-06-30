import { NextResponse } from "next/server";

import { listQrGenerateJobRecords } from "@/lib/quick-replica/qr-generate-history-service";
import { requireQuickReplicaUser } from "@/lib/quick-replica/qr-platform-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireQuickReplicaUser(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 40;

  try {
    const jobs = await listQrGenerateJobRecords(auth.userId, Number.isFinite(limit) ? limit : 40);
    return NextResponse.json({ jobs });
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
