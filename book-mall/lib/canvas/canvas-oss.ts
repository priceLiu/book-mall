/**
 * 把 KIE 临时 URL 中转到 OSS 的稳定公网 URL（canvas 子域）。
 * 实现方式 mirror book-mall/lib/story/story-oss.ts。
 */
import {
  createOssClientFrom,
  readOssEnv,
  type OssEnvConfig,
} from "@/lib/oss-client";
import { buildCanvasOssKey, type CanvasOssKind } from "./canvas-constants";

const MAX_IMAGE_BYTES = 30 * 1024 * 1024; // 30MB

function virtualHostedPublicUrl(cfg: OssEnvConfig, key: string): string {
  const base = process.env.OSS_PUBLIC_URL_BASE?.trim().replace(/\/$/, "");
  if (base) return `${base}/${key}`;
  return `https://${cfg.bucket}.${cfg.region}.aliyuncs.com/${key}`;
}

function extForUrlPath(pathname: string): string {
  const lower = pathname.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpg";
  if (lower.endsWith(".png")) return "png";
  if (lower.endsWith(".webp")) return "webp";
  return "";
}

function extForMime(contentType: string): string {
  const base = contentType.split(";")[0].trim().toLowerCase();
  if (base === "image/jpeg" || base === "image/jpg") return "jpg";
  if (base === "image/png") return "png";
  if (base === "image/webp") return "webp";
  return "";
}

async function downloadToBuffer(
  url: string,
  maxBytes: number,
): Promise<{ buf: Buffer; contentType: string; ext: string }> {
  const parsed = new URL(url);
  const r = await fetch(parsed.href, { method: "GET" });
  if (!r.ok) {
    throw new Error(`download failed: HTTP ${r.status}`);
  }
  const contentType = r.headers.get("content-type") ?? "";
  const len = Number(r.headers.get("content-length") ?? "0");
  if (len > 0 && len > maxBytes) {
    throw new Error(`download too large: ${len} > ${maxBytes}`);
  }
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.byteLength > maxBytes) {
    throw new Error(
      `download too large after fetch: ${buf.byteLength} > ${maxBytes}`,
    );
  }
  const ext = extForMime(contentType) || extForUrlPath(parsed.pathname) || "bin";
  return { buf, contentType, ext };
}

async function uploadBufferToOss(args: {
  cfg: OssEnvConfig;
  key: string;
  buf: Buffer;
  contentType: string;
}): Promise<string> {
  const client = await createOssClientFrom(args.cfg);
  const ct = args.contentType.split(";")[0].trim() || "application/octet-stream";
  let result: Awaited<ReturnType<typeof client.put>>;
  try {
    result = await client.put(args.key, args.buf, {
      headers: { "Content-Type": ct },
      ACL: "public-read",
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    if (
      /specified endpoint|must be addressed using the specified endpoint/i.test(raw)
    ) {
      throw new Error(
        `${raw} — 请将 OSS_REGION 改为 OSS 控制台 Bucket 的「访问域名 / 地域」一致。`,
      );
    }
    throw e;
  }
  const u = typeof result.url === "string" ? result.url.trim() : "";
  if (/^https:\/\//i.test(u)) return u;
  return virtualHostedPublicUrl(args.cfg, args.key);
}

export async function persistCanvasKieResultToOss(args: {
  ephemeralUrl: string;
  kind: CanvasOssKind;
  projectId?: string;
  userId?: string;
}): Promise<string> {
  const cfgRaw = readOssEnv();
  if ("error" in cfgRaw) {
    throw new Error(cfgRaw.error);
  }
  const cfg = cfgRaw;

  const sleeps = [0, 500, 2000];
  let lastError: unknown = null;
  for (let attempt = 0; attempt < sleeps.length; attempt++) {
    if (sleeps[attempt] > 0) {
      await new Promise((r) => setTimeout(r, sleeps[attempt]));
    }
    try {
      const dl = await downloadToBuffer(args.ephemeralUrl, MAX_IMAGE_BYTES);
      const ext = dl.ext || "png";
      const key = buildCanvasOssKey(args.kind, {
        projectId: args.projectId,
        userId: args.userId,
        ext,
      });
      const ossUrl = await uploadBufferToOss({
        cfg,
        key,
        buf: dl.buf,
        contentType: dl.contentType || "image/png",
      });
      return ossUrl;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? "persistCanvasKieResultToOss failed"));
}

/** 用户直传：把 buffer 上传到 OSS 并返回公网 URL。 */
export async function uploadCanvasUserBuffer(args: {
  buf: Buffer;
  contentType: string;
  userId: string;
  ext: string;
}): Promise<string> {
  const cfgRaw = readOssEnv();
  if ("error" in cfgRaw) {
    throw new Error(cfgRaw.error);
  }
  const key = buildCanvasOssKey("user-upload", {
    userId: args.userId,
    ext: args.ext,
  });
  return uploadBufferToOss({
    cfg: cfgRaw,
    key,
    buf: args.buf,
    contentType: args.contentType,
  });
}
