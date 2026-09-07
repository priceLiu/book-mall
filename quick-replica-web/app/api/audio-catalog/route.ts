import { NextResponse } from "next/server";

import { getBookMallBaseUrlServer } from "@/lib/book-mall-base-url.server";

export const dynamic = "force-dynamic";

/** dev:all 冷编译 book-mall / Next route 可能 >60s，不宜过短 */
const UPSTREAM_TIMEOUT_MS = 120_000;

/** 静态目录 · 直连 book-mall，不经 BFF token refresh（避免 dev 冷启动阻塞中栏） */
export async function GET() {
  const base = getBookMallBaseUrlServer();
  if (!base) {
    return NextResponse.json({ error: "book_mall_url_missing" }, { status: 503 });
  }

  const upstream = `${base.replace(/\/$/, "")}/api/platform/v1/quick-replica/audio-catalog`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const r = await fetch(upstream, {
      cache: "no-store",
      signal: controller.signal,
    });
    const body = await r.arrayBuffer();
    return new NextResponse(body, {
      status: r.status,
      headers: {
        "Content-Type": r.headers.get("content-type") ?? "application/json",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return NextResponse.json(
      {
        error: aborted ? "audio_catalog_timeout" : "audio_catalog_fetch_failed",
        message: e instanceof Error ? e.message : String(e),
      },
      { status: aborted ? 504 : 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
