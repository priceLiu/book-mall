import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  listStaticSnapshotGenerationRuns,
} from "@/lib/static-snapshots/site-home-snapshot-service";
import { SITE_HOME_PAGE_KEY } from "@/lib/static-snapshots/site-home-payload";
import { isStaticSnapshotPageKey } from "@/lib/static-snapshots/static-snapshot-run";

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

  const pageKeyParam = req.nextUrl.searchParams.get("pageKey") ?? SITE_HOME_PAGE_KEY;
  if (!isStaticSnapshotPageKey(pageKeyParam)) {
    return NextResponse.json({ error: "不支持的 pageKey" }, { status: 400 });
  }
  const pageKey = pageKeyParam;
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
