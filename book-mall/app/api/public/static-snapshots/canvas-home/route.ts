import { NextRequest, NextResponse } from "next/server";

import { getPublicCanvasHomeSnapshot } from "@/lib/static-snapshots/canvas-home-snapshot-service";
import { summarizeCanvasHomePayload } from "@/lib/static-snapshots/canvas-home-payload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const dateKey = req.nextUrl.searchParams.get("dateKey") ?? undefined;
  const result = await getPublicCanvasHomeSnapshot(dateKey ?? undefined);

  return NextResponse.json(
    {
      dateKey: result.dateKey,
      stale: result.stale,
      source: result.source,
      summary: summarizeCanvasHomePayload(result.payload),
      payload: result.payload,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    },
  );
}
