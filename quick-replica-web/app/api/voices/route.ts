import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { getBookMallBaseUrlServer } from "@/lib/book-mall-base-url.server";

export const dynamic = "force-dynamic";

/** dev:all 冷编译 route 可能 >60s */
const UPSTREAM_TIMEOUT_MS = 120_000;

/**
 * 音色分页 · 服务端转发 book-mall。
 * MiniMax 目录为本地 JSON，无需 tools_token；ElevenLabs 列表需 Bearer（仍经 Gateway，在 book-mall 内完成）。
 */
export async function GET(request: NextRequest) {
  const base = getBookMallBaseUrlServer();
  if (!base) {
    return NextResponse.json({ error: "book_mall_url_missing" }, { status: 503 });
  }

  const incoming = new URL(request.url);
  const provider = incoming.searchParams.get("provider")?.trim().toLowerCase() ?? "minimax";
  const upstream = new URL(`${base.replace(/\/$/, "")}/api/platform/v1/quick-replica/voices`);
  incoming.searchParams.forEach((value, key) => {
    upstream.searchParams.set(key, value);
  });

  const headers = new Headers();
  if (provider === "elevenlabs" || provider === "eleven") {
    const token = cookies().get("tools_token")?.value?.trim();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const r = await fetch(upstream.toString(), {
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
    const body = await r.arrayBuffer();
    return new NextResponse(body, {
      status: r.status,
      headers: {
        "Content-Type": r.headers.get("content-type") ?? "application/json",
        "Cache-Control": provider === "minimax" ? "private, max-age=120" : "no-store",
      },
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return NextResponse.json(
      { error: aborted ? "voices_timeout" : "voices_fetch_failed" },
      { status: aborted ? 504 : 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
