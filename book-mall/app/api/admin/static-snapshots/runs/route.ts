import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  listStaticSnapshotGenerationRuns,
  SITE_HOME_PAGE_KEY,
} from "@/lib/static-snapshots/site-home-snapshot-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const role = (session?.user?.role ?? "").toUpperCase();
  if (!session?.user?.id || (role !== "ADMIN" && role !== "SUPER_ADMIN")) {
    return null;
  }
  return session.user;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const pageKey = req.nextUrl.searchParams.get("pageKey") ?? SITE_HOME_PAGE_KEY;
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "30");
  const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, limitRaw)) : 30;

  const runs = await listStaticSnapshotGenerationRuns(pageKey, limit);
  return NextResponse.json({
    pageKey,
    runs: runs.map((r) => ({
      ...r,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
    })),
  });
}
