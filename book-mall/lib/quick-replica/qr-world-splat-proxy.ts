import { NextResponse } from "next/server";

import {
  forwardWorldlabsGetWorld,
  isAllowedWorldSplatUpstreamUrl,
  listWorldSplatUrls,
} from "@/lib/gateway/worldlabs-proxy";
import { findBuiltinWorldAssetEntry } from "@/lib/quick-replica/builtin-world-gallery-assets";
import { requireWorldlabsAuth } from "@/lib/quick-replica/qr-world-service";

const CACHE_TTL_MS = 15 * 60 * 1000;

type CacheEntry = { urls: Set<string>; expires: number };

const splatUrlCache = new Map<string, CacheEntry>();

function cacheKey(userId: string, worldId: string): string {
  return `${userId}:${worldId.trim()}`;
}

/** 在 qrGetWorldViewerPayload 成功后写入，避免每个 splat 分片都再打 World Labs API。 */
export function rememberWorldSplatUrls(userId: string, worldId: string, urls: string[]): void {
  splatUrlCache.set(cacheKey(userId, worldId), {
    urls: new Set(urls),
    expires: Date.now() + CACHE_TTL_MS,
  });
}

function normalizeSplatUrl(url: string): string {
  return url.trim();
}

function isUrlAllowed(allowed: Set<string>, upstream: string): boolean {
  const target = normalizeSplatUrl(upstream);
  if (allowed.has(target)) return true;
  for (const item of allowed) {
    if (normalizeSplatUrl(item) === target) return true;
  }
  return false;
}

async function getAllowedWorldSplatUrls(userId: string, worldId: string): Promise<Set<string>> {
  try {
    const local = findBuiltinWorldAssetEntry(worldId);
    if (local && local.splatUrls.length) {
      return new Set(local.splatUrls.map(normalizeSplatUrl));
    }
  } catch (err) {
    console.warn("[qr-world-splat-proxy] local asset read failed", err);
  }

  const key = cacheKey(userId, worldId);
  const hit = splatUrlCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.urls;

  const { credentialId } = await requireWorldlabsAuth(userId);
  const { world } = await forwardWorldlabsGetWorld({
    credentialId,
    worldId: worldId.trim(),
  });
  const urls = listWorldSplatUrls(world);
  rememberWorldSplatUrls(userId, worldId, urls);
  return new Set(urls);
}

export async function proxyWorldSplatAsset(args: {
  userId: string;
  worldId: string;
  upstreamUrl: string;
}): Promise<Response> {
  const upstream = normalizeSplatUrl(args.upstreamUrl);
  if (!upstream || !isAllowedWorldSplatUpstreamUrl(upstream)) {
    return NextResponse.json({ error: "invalid_splat_url" }, { status: 400 });
  }

  let allowed: Set<string>;
  try {
    allowed = await getAllowedWorldSplatUrls(args.userId, args.worldId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "splat_allowlist_failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!isUrlAllowed(allowed, upstream)) {
    return NextResponse.json({ error: "splat_url_not_in_world" }, { status: 403 });
  }

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstream, { redirect: "follow", cache: "no-store" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "upstream_fetch_failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
  if (!upstreamRes.ok) {
    return NextResponse.json(
      { error: `upstream_http_${upstreamRes.status}` },
      { status: 502 },
    );
  }

  const headers = new Headers();
  headers.set(
    "content-type",
    upstreamRes.headers.get("content-type") ?? "application/octet-stream",
  );
  const contentLength = upstreamRes.headers.get("content-length");
  if (contentLength) headers.set("content-length", contentLength);
  headers.set("cache-control", "private, max-age=3600");

  return new NextResponse(upstreamRes.body, { status: 200, headers });
}
