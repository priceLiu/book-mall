import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  isStaticSnapshotPageKey,
  runStaticSnapshotGeneration,
} from "@/lib/static-snapshots/static-snapshot-run";
import { SITE_HOME_PAGE_KEY } from "@/lib/static-snapshots/site-home-payload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const role = (session?.user?.role ?? "").toUpperCase();
  if (!session?.user?.id || (role !== "ADMIN" && role !== "SUPER_ADMIN")) {
    return null;
  }
  return session.user;
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let pageKey: string = SITE_HOME_PAGE_KEY;
  try {
    const body = (await req.json()) as { pageKey?: string };
    if (body.pageKey?.trim()) pageKey = body.pageKey.trim();
  } catch {
    // empty body ok
  }

  if (!isStaticSnapshotPageKey(pageKey)) {
    return NextResponse.json({ error: "不支持的 pageKey" }, { status: 400 });
  }

  try {
    const result = await runStaticSnapshotGeneration({
      pageKey,
      trigger: "ADMIN",
      triggeredByUserId: admin.id,
    });
    return NextResponse.json({
      ok: true,
      pageKey,
      dateKey: result.dateKey,
      summary: result.summary,
      generatedAt: result.snapshot.generatedAt.toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[admin/static-snapshots/generate]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
