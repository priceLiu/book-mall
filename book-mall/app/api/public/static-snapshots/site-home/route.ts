import { NextRequest, NextResponse } from "next/server";

import { getPublicSiteHomeSnapshot } from "@/lib/static-snapshots/site-home-snapshot-service";
import { summarizeSiteHomePayload } from "@/lib/static-snapshots/site-home-payload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const dateKey = req.nextUrl.searchParams.get("dateKey") ?? undefined;
  const result = await getPublicSiteHomeSnapshot(dateKey ?? undefined);

  return NextResponse.json(
    {
      dateKey: result.dateKey,
      stale: result.stale,
      source: result.source,
      summary: summarizeSiteHomePayload(result.payload),
      payload: result.payload,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    },
  );
}
