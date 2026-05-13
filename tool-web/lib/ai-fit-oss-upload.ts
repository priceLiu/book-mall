import { randomUUID } from "crypto";
import { Agent, fetch as undiciFetch } from "undici";
import {
  createOssClientFrom,
  readOssEnv,
  type OssEnvConfig,
} from "@/lib/oss-client";

const MAX_REHOST_BYTES = 15 * 1024 * 1024;

/** 已知 TLS/可达性会让百炼无法直接拉取的主机：通过本服务端中转上传到 OSS */
const FORCE_REHOST_HOSTS = new Set<string>([
  "static-main.aiyeshi.cn",
]);

function extForMime(contentType: string): string {
  const base = contentType.split(";")[0].trim().toLowerCase();
  if (base === "image/jpeg" || base === "image/jpg") return "jpg";
  if (base === "image/png") return "png";
  if (base === "image/webp") return "webp";
  return "bin";
}

function extForUrlPath(pathname: string): string {
  const lower = pathname.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpg";
  if (lower.endsWith(".png")) return "png";
  if (lower.endsWith(".webp")) return "webp";
  return "bin";
}

function cleanContentType(contentType: string): string {
  return contentType.split(";")[0].trim();
}

function virtualHostedPublicUrl(cfg: OssEnvConfig, key: string): string {
  const base = process.env.OSS_PUBLIC_URL_BASE?.trim().replace(/\/$/, "");
  if (base) return `${base}/${key}`;
  return `https://${cfg.bucket}.${cfg.region}.aliyuncs.com/${key}`;
}

/** 上传试衣用图片到 OSS，返回公网 HTTPS URL（供百炼拉取）。 */
export async function uploadAiFitImageToOss(
  buffer: Buffer,
  contentType: string,
  folder: "tryon" | "result" | "text2image" = "tryon",
): Promise<string> {
  const cfg = readOssEnv();
  if ("error" in cfg) throw new Error(cfg.error);

  const client = await createOssClientFrom(cfg);
  const ext = extForMime(contentType);
  const prefix =
    folder === "result"
      ? "ai-fit/result"
      : folder === "text2image"
        ? "text-to-image/generated"
        : "ai-fit/tryon";
  const key = `${prefix}/${randomUUID()}.${ext}`;
  const ct = cleanContentType(contentType);

  let result: Awaited<ReturnType<typeof client.put>>;
  try {
    result = await client.put(key, buffer, {
      headers: { "Content-Type": ct },
      ACL: "public-read",
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    if (/specified endpoint|must be addressed using the specified endpoint/i.test(raw)) {
      throw new Error(
        `${raw} — 请将 OSS_REGION（及可选 OSS_ENDPOINT）改为 OSS 控制台里该 Bucket 的「访问域名 / 地域」一致。例如华北2（北京）应为 oss-cn-beijing 与 https://oss-cn-beijing.aliyuncs.com。`,
      );
    }
    throw e;
  }

  const u = typeof result.url === "string" ? result.url.trim() : "";
  if (/^https:\/\//i.test(u)) return u;
  return virtualHostedPublicUrl(cfg, key);
}

/** 已知会让百炼拉取失败的远端图（如 TLS 证书过期、私网）→ 是否需要中转上传到 OSS */
export function shouldRehostRemoteUrl(remoteUrl: string): boolean {
  try {
    const u = new URL(remoteUrl);
    if (u.protocol === "http:") return true;
    if (FORCE_REHOST_HOSTS.has(u.hostname)) return true;
    return false;
  } catch {
    return false;
  }
}

async function downloadRemoteImageBuffer(remoteUrl: string): Promise<{
  buf: Buffer;
  contentType: string;
  href: string;
}> {
  let parsed: URL;
  try {
    parsed = new URL(remoteUrl.trim());
  } catch {
    throw new Error(`无效的图片 URL：${remoteUrl}`);
  }

  let href = parsed.href;
  if (parsed.protocol === "http:" && /\.aliyuncs\.com$/i.test(parsed.hostname)) {
    href = href.replace(/^http:/i, "https:");
    parsed = new URL(href);
  }

  /** 对已知证书过期的 CDN 放宽 TLS 校验，其余主机仍按默认校验 */
  const insecure = FORCE_REHOST_HOSTS.has(parsed.hostname);
  const dispatcher = insecure
    ? new Agent({ connect: { rejectUnauthorized: false } })
    : undefined;

  const res = await undiciFetch(href, {
    dispatcher,
    redirect: "follow",
    headers: {
      "User-Agent": "tool-web-ai-fit-rehost/1.0",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
  });

  if (!res.ok) {
    throw new Error(`下载图片失败：HTTP ${res.status} ← ${href}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) throw new Error(`图片为空：${href}`);
  if (buf.length > MAX_REHOST_BYTES) {
    throw new Error(`图片过大（>${Math.round(MAX_REHOST_BYTES / 1024 / 1024)}MB）：${href}`);
  }

  const rawCt = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  let contentType = rawCt.startsWith("image/") ? rawCt : "";
  if (!contentType) {
    const ext = extForUrlPath(parsed.pathname);
    contentType =
      ext === "jpg"
        ? "image/jpeg"
        : ext === "png"
          ? "image/png"
          : ext === "webp"
            ? "image/webp"
            : "image/png";
  }

  return { buf, contentType, href };
}

/** 由服务端下载远端图并上传 OSS，返回 OSS 公网 HTTPS URL（用于交给百炼）。 */
export async function rehostRemoteImageToOss(remoteUrl: string): Promise<string> {
  const { buf, contentType } = await downloadRemoteImageBuffer(remoteUrl);
  return uploadAiFitImageToOss(buf, contentType, "tryon");
}

/**
 * 百炼/Dashscope 返回的成片 URL 多为短期有效；下载后写入自有 OSS（ai-fit/result/），返回稳定公网 HTTPS。
 */
export async function persistTryOnResultImageToOss(
  ephemeralImageUrl: string,
): Promise<string> {
  const { buf, contentType } = await downloadRemoteImageBuffer(ephemeralImageUrl);
  return uploadAiFitImageToOss(buf, contentType, "result");
}

/** 文生图：DashScope 结果 URL 多为短期有效 → 下载写入自有 OSS（text-to-image/generated/） */
export async function persistTextToImageResultToOss(
  ephemeralImageUrl: string,
): Promise<string> {
  const { buf, contentType } = await downloadRemoteImageBuffer(ephemeralImageUrl);
  return uploadAiFitImageToOss(buf, contentType, "text2image");
}
