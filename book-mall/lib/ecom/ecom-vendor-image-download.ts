import { isTransientUpstreamConnectError } from "@/lib/gateway/format-fetch-error";

const DOWNLOAD_TIMEOUT_MS = 120_000;
const MAX_ATTEMPTS = 4;

function describeFetchFailure(err: unknown): string {
  const cause = err instanceof Error && err.cause != null ? err.cause : err;
  const code =
    cause != null && typeof cause === "object"
      ? String((cause as { code?: string }).code ?? "")
      : "";
  const msg =
    cause instanceof Error
      ? cause.message
      : err instanceof Error
        ? err.message
        : String(err ?? "");

  if (code === "ETIMEDOUT" || /timeout|timed out/i.test(msg)) {
    return "服务端拉取厂商成图超时，请稍后重试（与本机浏览器网络无关）";
  }
  if (code === "ECONNRESET" || code === "EPIPE" || /ECONNRESET|EPIPE/i.test(msg)) {
    return "服务端拉取厂商成图时连接被重置，请重试";
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return "服务端无法解析成图地址，请重试或附上 Log ID 联系支持";
  }
  if (msg === "fetch failed" || msg === "Failed to fetch") {
    return "服务端拉取厂商成图失败（Book→厂商 CDN），请稍后重试；与本机浏览器网络无关";
  }
  if (/HTTP \d+/.test(msg)) {
    return `服务端拉取厂商成图 ${msg}，请稍后重试`;
  }
  const detail = [code, msg].filter(Boolean).join(" · ");
  return detail || "未知错误";
}

function isRetryableDownloadError(err: unknown): boolean {
  if (isTransientUpstreamConnectError(err)) return true;
  if (err instanceof Error) {
    if (/HTTP 429|HTTP 5\d\d/.test(err.message)) return true;
    if (/成图内容为空/.test(err.message)) return true;
  }
  return false;
}

/** 槽位预览 / 代理：允许拉取的厂商成图域名（KIE nano-banana-pro 等） */
export function isEcomVendorPreviewImageUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const h = u.hostname.toLowerCase();
    if (h.includes("aliyuncs.com")) return true;
    if (h.includes("kie.ai")) return true;
    if (h.includes("dashscope") || h.includes("aliyun")) return true;
    if (h.includes("googleusercontent") || h.includes("googleapis")) return true;
    if (h.includes("cloudfront.net") || h.includes("amazonaws.com")) return true;
    return false;
  } catch {
    return false;
  }
}

/** 将 Gateway 轮询得到的厂商成图 URL 下载到内存（Book 侧转存 OSS 前） */
export async function fetchEcomVendorImageBuffer(imageUrl: string): Promise<Buffer> {
  const url = imageUrl.trim();
  if (!url) throw new Error("下载生成图失败：成图 URL 为空");
  if (!/^https?:\/\//i.test(url)) {
    throw new Error(`下载生成图失败：成图 URL 无效（${url.slice(0, 96)}）`);
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 500 + attempt * 750));
    }
    try {
      const signal = AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS);
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        cache: "no-store",
        headers: { Accept: "image/*,*/*" },
        signal,
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) {
        throw new Error("成图内容为空");
      }
      return buf;
    } catch (e) {
      lastErr = e;
      if (isRetryableDownloadError(e) && attempt < MAX_ATTEMPTS - 1) {
        continue;
      }
      break;
    }
  }

  throw new Error(`下载生成图失败：${describeFetchFailure(lastErr)}`);
}
