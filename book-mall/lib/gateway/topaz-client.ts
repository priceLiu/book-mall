/**
 * Topaz Labs Video API client
 * @see docs/topaz.md · Express Request (POST /video/express)
 */

import {
  resolveTopazApiRoot,
  topazAuthHeaders,
  type TopazFilterModel,
} from "@/lib/gateway/topaz-models";

export class TopazUpstreamError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "TopazUpstreamError";
  }
}

export type TopazExpressCreateResponse = {
  requestId: string;
  uploadId?: string;
  uploadUrls?: string[];
};

export type TopazVideoStatusResponse = {
  status?: string;
  state?: string;
  progress?: number;
  download?: { url?: string };
  downloadUrl?: string;
  outputUrl?: string;
  message?: string;
  error?: string;
};

function pickDownloadUrl(body: TopazVideoStatusResponse): string | null {
  const candidates = [
    body.download?.url,
    body.downloadUrl,
    body.outputUrl,
  ];
  for (const c of candidates) {
    const u = typeof c === "string" ? c.trim() : "";
    if (/^https?:\/\//.test(u)) return u;
  }
  return null;
}

function normalizeTopazStatus(raw: string | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

export function isTopazVideoStatusSuccess(body: TopazVideoStatusResponse): boolean {
  const s = normalizeTopazStatus(body.status ?? body.state);
  return (
    s === "complete" ||
    s === "completed" ||
    s === "succeeded" ||
    s === "success" ||
    s === "done"
  );
}

export function isTopazVideoStatusFailed(body: TopazVideoStatusResponse): boolean {
  const s = normalizeTopazStatus(body.status ?? body.state);
  return (
    s === "failed" ||
    s === "error" ||
    s === "cancelled" ||
    s === "canceled"
  );
}

export function isTopazVideoStatusInProgress(
  body: TopazVideoStatusResponse,
): boolean {
  if (isTopazVideoStatusSuccess(body) || isTopazVideoStatusFailed(body)) {
    return false;
  }
  const s = normalizeTopazStatus(body.status ?? body.state);
  return (
    !s ||
    s === "queued" ||
    s === "processing" ||
    s === "running" ||
    s === "uploading" ||
    s === "pending" ||
    s === "in_progress" ||
    s === "in-progress"
  );
}

export function topazVideoStatusDownloadUrl(
  body: TopazVideoStatusResponse,
): string | null {
  if (!isTopazVideoStatusSuccess(body)) return null;
  return pickDownloadUrl(body);
}

async function topazJson<T>(
  apiKey: string,
  baseUrl: string | null | undefined,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const root = resolveTopazApiRoot(baseUrl);
  const url = `${root}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...topazAuthHeaders(apiKey),
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* keep text */
  }
  if (!res.ok) {
    const msg =
      typeof body === "object" &&
      body &&
      "message" in body &&
      typeof (body as { message?: unknown }).message === "string"
        ? (body as { message: string }).message
        : text.slice(0, 500) || res.statusText;
    throw new TopazUpstreamError(
      `Topaz API ${res.status}: ${msg}`,
      res.status,
      body,
    );
  }
  return body as T;
}

export async function topazCreateExpressVideoRequest(opts: {
  apiKey: string;
  baseUrl?: string | null;
  filterModel: TopazFilterModel;
  upscaleFactor?: number;
  slowmo?: number;
  frameInterpolation?: "none" | "high";
}): Promise<TopazExpressCreateResponse> {
  const factor = opts.upscaleFactor ?? 2;
  const slowmo = parseTopazSlowmoFactor(opts.slowmo);
  const filter: Record<string, unknown> = {
    model: opts.filterModel,
    slowmo,
  };
  if (opts.frameInterpolation === "high") {
    filter.duplicate = true;
    filter.fps = 60;
    filter.duplicateThreshold = 0.1;
  } else {
    filter.duplicate = false;
  }
  const body = {
    filters: [filter],
    output: {
      container: "mp4",
      audioCodec: "AAC",
      audioTransfer: "Copy",
      dynamicCompressionLevel: "High",
      upscale: factor,
    },
  };
  const raw = await topazJson<Record<string, unknown>>(
    opts.apiKey,
    opts.baseUrl,
    "/video/express",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const requestId = String(raw.requestId ?? raw.request_id ?? "").trim();
  const uploadUrls = Array.isArray(raw.uploadUrls)
    ? raw.uploadUrls.filter((u): u is string => typeof u === "string")
    : Array.isArray(raw.upload_urls)
      ? raw.upload_urls.filter((u): u is string => typeof u === "string")
      : [];
  if (!requestId) {
    throw new TopazUpstreamError("Topaz express create missing requestId");
  }
  if (!uploadUrls.length) {
    throw new TopazUpstreamError("Topaz express create missing uploadUrls");
  }
  return {
    requestId,
    uploadId:
      typeof raw.uploadId === "string"
        ? raw.uploadId
        : typeof raw.upload_id === "string"
          ? raw.upload_id
          : undefined,
    uploadUrls,
  };
}

export async function topazUploadVideoToSignedUrl(opts: {
  uploadUrl: string;
  videoBytes: Buffer | Uint8Array;
  contentType?: string;
}): Promise<string | undefined> {
  const res = await fetch(opts.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": opts.contentType ?? "video/mp4",
    },
    body: new Uint8Array(opts.videoBytes),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new TopazUpstreamError(
      `Topaz video upload failed ${res.status}: ${text.slice(0, 300)}`,
      res.status,
    );
  }
  const etag = res.headers.get("etag") ?? res.headers.get("ETag");
  return etag?.replace(/^"|"$/g, "") ?? undefined;
}

export async function topazGetVideoStatus(opts: {
  apiKey: string;
  baseUrl?: string | null;
  requestId: string;
}): Promise<TopazVideoStatusResponse> {
  const raw = await topazJson<Record<string, unknown>>(
    opts.apiKey,
    opts.baseUrl,
    `/video/${encodeURIComponent(opts.requestId)}/status`,
    { method: "GET" },
  );
  return raw as TopazVideoStatusResponse;
}

export async function topazDownloadSourceVideo(videoUrl: string): Promise<{
  bytes: Buffer;
  contentType: string;
}> {
  const url = videoUrl.trim();
  if (!/^https?:\/\//.test(url)) {
    throw new TopazUpstreamError("video_url must be https URL");
  }
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    throw new TopazUpstreamError(
      `Failed to download source video: HTTP ${res.status}`,
      res.status,
    );
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const max = 500 * 1024 * 1024;
  if (buf.length > max) {
    throw new TopazUpstreamError(
      `Source video exceeds Topaz 500MB limit (${Math.round(buf.length / 1024 / 1024)}MB)`,
    );
  }
  const contentType =
    res.headers.get("content-type")?.split(";")[0]?.trim() || "video/mp4";
  return { bytes: buf, contentType };
}

export function parseTopazFilterModel(raw: unknown): TopazFilterModel {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "starlight-precise-2" || s === "starlight") return "starlight-precise-2";
  if (s === "apo-8" || s === "apo8") return "apo-8";
  return "proteus";
}

export function parseTopazUpscaleFactor(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseInt(String(raw ?? "2"), 10);
  if (n === 1 || n === 4) return n;
  return 2;
}

export function parseTopazSlowmoFactor(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseInt(String(raw ?? "1"), 10);
  if (n === 2 || n === 3 || n === 5) return n;
  return 1;
}

export function parseTopazFrameInterpolation(
  raw: unknown,
): "none" | "high" {
  const s = String(raw ?? "").trim().toLowerCase();
  if (
    s === "high" ||
    s === "high_quality" ||
    s === "quality" ||
    s === "duplicate"
  ) {
    return "high";
  }
  return "none";
}

export function topazUpscaleFromHdResolution(raw: unknown): number {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "4k") return 4;
  if (s === "2k") return 2;
  return 1;
}
