import { NextRequest, NextResponse } from "next/server";

import { getPublicQuickReplicaGallerySnapshot } from "@/lib/static-snapshots/quick-replica-gallery-snapshot-service";
import { summarizeQuickReplicaGalleryPayload } from "@/lib/static-snapshots/quick-replica-gallery-payload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const dateKey = req.nextUrl.searchParams.get("dateKey") ?? undefined;
  const result = await getPublicQuickReplicaGallerySnapshot(dateKey ?? undefined);
  if (!result) {
    return NextResponse.json(
      { error: "snapshot_not_ready", message: "QuickReplica gallery 快照尚未生成" },
      { status: 404 },
    );
  }

  return NextResponse.json(
    {
      dateKey: result.dateKey,
      stale: result.stale,
      source: result.source,
      summary: summarizeQuickReplicaGalleryPayload(result.payload),
      payload: result.payload,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    },
  );
}
