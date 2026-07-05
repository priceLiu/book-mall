import { NextRequest, NextResponse } from "next/server";

import { getBookMallBaseUrlServer } from "@/lib/book-mall-base-url.server";
import { ensureProxyToolsBearer } from "@/lib/book-mall-proxy-auth";
import {
  benchSplatDownload,
  SPLAT_BENCH_VERDICT_HINT,
  verdictForBench,
  type SplatBenchSample,
} from "@/lib/qr-world-splat-bench";
import { proxifyWorldSplatUrl } from "@/lib/qr-world-viewer-api";

export const dynamic = "force-dynamic";

type WorldPayload = {
  worldId: string;
  displayName?: string;
  preview100kSpzUrl?: string | null;
  fullResSpzUrl?: string | null;
  highResSpzUrl?: string | null;
  spzUrl?: string | null;
};

function benchPath(origin: string, worldId: string, upstream: string): string {
  const proxied = proxifyWorldSplatUrl(worldId, upstream);
  if (!proxied) return upstream;
  if (proxied.startsWith("http")) return proxied;
  return `${origin.replace(/\/$/, "")}${proxied}`;
}

export async function GET(request: NextRequest) {
  const worldId = request.nextUrl.searchParams.get("worldId")?.trim();
  if (!worldId) {
    return NextResponse.json({ error: "missing_worldId" }, { status: 400 });
  }

  const token = request.cookies.get("tools_token")?.value?.trim();
  if (!token) {
    return NextResponse.json(
      { error: "未登录", hint: "请先登录快速复制，再打开本测速接口" },
      { status: 401 },
    );
  }

  const bookBase = getBookMallBaseUrlServer();
  if (!bookBase) {
    return NextResponse.json({ error: "book_mall_url_missing" }, { status: 503 });
  }

  const { bearer } = await ensureProxyToolsBearer(request);
  const authHeaders: HeadersInit = bearer
    ? { Authorization: `Bearer ${bearer}` }
    : { cookie: request.headers.get("cookie") ?? "" };

  const payloadRes = await fetch(
    `${bookBase}/api/platform/v1/quick-replica/worlds/${encodeURIComponent(worldId)}`,
    { headers: authHeaders, cache: "no-store" },
  );
  if (!payloadRes.ok) {
    const err = (await payloadRes.json().catch(() => ({}))) as { error?: string };
    return NextResponse.json(
      { error: err.error ?? `payload_http_${payloadRes.status}` },
      { status: payloadRes.status },
    );
  }

  const payload = (await payloadRes.json()) as WorldPayload;
  const origin = request.nextUrl.origin;

  const tiers: Array<{ tier: string; upstream: string | null | undefined }> = [
    { tier: "100k_preview", upstream: payload.preview100kSpzUrl },
    {
      tier: "full_res",
      upstream: payload.fullResSpzUrl ?? payload.highResSpzUrl ?? payload.spzUrl,
    },
  ];

  const cookie = request.headers.get("cookie") ?? "";
  const samples: SplatBenchSample[] = [];

  for (const { tier, upstream } of tiers) {
    if (!upstream?.trim()) continue;
    const bffUrl = benchPath(origin, worldId, upstream);
    samples.push(
      await benchSplatDownload({
        tier,
        url: bffUrl,
        fetchInit: { headers: { cookie } },
      }),
    );
  }

  const fullRes = samples.find((s) => s.tier === "full_res");
  const verdict = fullRes ? verdictForBench(fullRes) : "very_slow";

  return NextResponse.json({
    service: "quick-replica-web",
    worldId,
    displayName: payload.displayName ?? null,
    origin,
    pathNote:
      "采样走与浏览器相同的 /api/book-mall/.../splat 路径（2MB Range 采样，不拉完整高清包）",
    samples: samples.map((s) => ({
      ...s,
      verdict: verdictForBench(s),
      verdictHint: SPLAT_BENCH_VERDICT_HINT[verdictForBench(s)],
    })),
    summary: {
      fullResVerdict: verdict,
      fullResHint: SPLAT_BENCH_VERDICT_HINT[verdict],
      compareNote:
        fullRes?.estimatedFullHuman && fullRes.contentLengthHuman
          ? `高清档约 ${fullRes.contentLengthHuman}，按当前速度预计 ${fullRes.estimatedFullHuman} 下完`
          : null,
    },
    usage: {
      local: `${origin}/api/world-splat-bench?worldId=${encodeURIComponent(worldId)}`,
      exampleWorldId: "6425f0fd-fed4-4569-9d92-1ea90f5627d0",
    },
  });
}
