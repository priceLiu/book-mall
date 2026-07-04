import { NextResponse } from "next/server";

import {
  extractWorldThumbnailUrl,
  forwardWorldlabsGetWorld,
} from "@/lib/gateway/worldlabs-proxy";
import { findBuiltinWorldAssetEntry } from "@/lib/quick-replica/builtin-world-gallery-assets";
import { requireWorldlabsAuth } from "@/lib/quick-replica/qr-world-service";

const CACHE_TTL_MS = 15 * 60 * 1000;

type CacheEntry = { urls: Set<string>; expires: number };

const imageUrlCache = new Map<string, CacheEntry>();

const WORLD_IMAGE_HOST_SUFFIXES = [
  "worldlabs.ai",
  "googleapis.com",
  "googleusercontent.com",
  "aliyuncs.com",
];

function cacheKey(userId: string, worldId: string): string {
  return `${userId}:${worldId.trim()}`;
}

function normalizeImageUrl(url: string): string {
  return url.trim();
}

function isAllowedWorldImageUpstreamUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    return WORLD_IMAGE_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
  } catch {
    return false;
  }
}

function isUrlAllowed(allowed: Set<string>, upstream: string): boolean {
  const target = normalizeImageUrl(upstream);
  if (allowed.has(target)) return true;
  for (const item of allowed) {
    if (normalizeImageUrl(item) === target) return true;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchUpstreamWithRetry(url: string, attempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, { redirect: "follow", cache: "no-store" });
      if (res.ok) return res;
      if (res.status >= 500 && i < attempts - 1) {
        await sleep(400 * (i + 1));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) await sleep(400 * (i + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("upstream_fetch_failed");
}

/** 在 qrGetWorldViewerPayload 成功后写入，避免每个 image 请求都打 World Labs API。 */
export function rememberWorldImageUrls(userId: string, worldId: string, urls: string[]): void {
  imageUrlCache.set(cacheKey(userId, worldId), {
    urls: new Set(urls.map(normalizeImageUrl)),
    expires: Date.now() + CACHE_TTL_MS,
  });
}

async function getAllowedWorldImageUrls(userId: string, worldId: string): Promise<Set<string>> {
  try {
    const local = findBuiltinWorldAssetEntry(worldId);
    if (local) {
      const urls = [
        local.panoUrl,
        local.thumbnailUrl,
        ...local.sceneImageUrls,
      ].filter((u): u is string => Boolean(u?.trim()));
      if (urls.length) return new Set(urls.map(normalizeImageUrl));
    }
  } catch (err) {
    console.warn("[qr-world-image-proxy] local asset read failed", err);
  }

  const key = cacheKey(userId, worldId);
  const hit = imageUrlCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.urls;

  const { credentialId } = await requireWorldlabsAuth(userId);
  const { world } = await forwardWorldlabsGetWorld({
    credentialId,
    worldId: worldId.trim(),
  });
  const urls = [
    world.assets?.imagery?.pano_url?.trim(),
    extractWorldThumbnailUrl(world),
  ].filter((u): u is string => Boolean(u?.trim()));
  rememberWorldImageUrls(userId, worldId, urls);
  return new Set(urls.map(normalizeImageUrl));
}

export async function proxyWorldImageAsset(args: {
  userId: string;
  worldId: string;
  upstreamUrl: string;
}): Promise<Response> {
  const upstream = normalizeImageUrl(args.upstreamUrl);
  if (!upstream || !isAllowedWorldImageUpstreamUrl(upstream)) {
    return NextResponse.json({ error: "invalid_image_url" }, { status: 400 });
  }

  let allowed: Set<string>;
  try {
    allowed = await getAllowedWorldImageUrls(args.userId, args.worldId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "image_allowlist_failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!isUrlAllowed(allowed, upstream)) {
    return NextResponse.json({ error: "image_url_not_in_world" }, { status: 403 });
  }

  let upstreamRes: Response;
  try {
    upstreamRes = await fetchUpstreamWithRetry(upstream);
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
    upstreamRes.headers.get("content-type") ?? "image/jpeg",
  );
  const contentLength = upstreamRes.headers.get("content-length");
  if (contentLength) headers.set("content-length", contentLength);
  headers.set("cache-control", "private, max-age=3600");
  const upstreamName = upstream.split("/").pop()?.split("?")[0] ?? "pano.jpg";
  headers.set(
    "Content-Disposition",
    `attachment; filename="${upstreamName.replace(/[^\w.-]+/g, "_")}"`,
  );

  return new NextResponse(upstreamRes.body, { status: 200, headers });
}
