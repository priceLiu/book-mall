import { readOssEnv } from "@/lib/oss-client";

const MAX_SCRIPT_TEXT_BYTES = 2 * 1024 * 1024;

/** 校验 URL 为本用户 canvas/user-upload 下的对象（防 SSRF） */
export function assertCanvasUserUploadOssUrl(
  ossUrl: string,
  userId: string,
): void {
  let u: URL;
  try {
    u = new URL(ossUrl.trim());
  } catch {
    throw new Error("INVALID_OSS_URL");
  }
  if (u.protocol !== "https:") {
    throw new Error("INVALID_OSS_URL");
  }

  const path = decodeURIComponent(u.pathname.replace(/^\//, ""));
  const required = `canvas/user-upload/${userId}/`;
  if (!path.includes(required)) {
    throw new Error("FORBIDDEN_OSS_URL");
  }

  const cfgRaw = readOssEnv();
  if ("error" in cfgRaw) return;

  const hosts = new Set<string>();
  hosts.add(`${cfgRaw.bucket}.${cfgRaw.region}.aliyuncs.com`);
  const publicBase = process.env.OSS_PUBLIC_URL_BASE?.trim().replace(/\/$/, "");
  if (publicBase) {
    try {
      hosts.add(new URL(publicBase).hostname);
    } catch {
      /* ignore */
    }
  }

  if (!hosts.has(u.hostname)) {
    throw new Error("FORBIDDEN_OSS_HOST");
  }
}

export async function readCanvasUserUploadText(ossUrl: string): Promise<string> {
  const r = await fetch(ossUrl, { method: "GET", cache: "no-store" });
  if (!r.ok) {
    throw new Error(`OSS_READ_HTTP_${r.status}`);
  }
  const len = Number(r.headers.get("content-length") ?? "0");
  if (len > MAX_SCRIPT_TEXT_BYTES) {
    throw new Error("OSS_TEXT_TOO_LARGE");
  }
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.byteLength > MAX_SCRIPT_TEXT_BYTES) {
    throw new Error("OSS_TEXT_TOO_LARGE");
  }
  return buf.toString("utf8");
}
