import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { createOssClientFrom, ossGetBuffer, readOssEnv } from "@/lib/oss-client";

function parseDataUrl(dataUrl: string): { buf: Buffer; contentType: string; ext: string } {
  const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl.trim());
  if (!m) throw new Error("无效的图片 data URL");
  const contentType = m[1] || "image/png";
  const buf = Buffer.from(m[2], "base64");
  const ext = contentType.includes("jpeg")
    ? "jpg"
    : contentType.includes("webp")
      ? "webp"
      : "png";
  return { buf, contentType, ext };
}

function tryParseManagedOssObjectKey(url: string): string | null {
  const cfg = readOssEnv();
  if ("error" in cfg) return null;
  try {
    const u = new URL(url);
    const base = process.env.OSS_PUBLIC_URL_BASE?.trim().replace(/\/$/, "");
    if (base && url.startsWith(`${base}/`)) {
      return decodeURIComponent(url.slice(base.length + 1));
    }
    if (u.hostname === `${cfg.bucket}.${cfg.region}.aliyuncs.com`) {
      return decodeURIComponent(u.pathname.replace(/^\//, ""));
    }
  } catch {
    return null;
  }
  return null;
}

async function isVendorFetchableHttpUrl(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    if (r.ok) return true;
    if (r.status === 405) {
      const getRes = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(20_000),
        redirect: "follow",
        headers: { Range: "bytes=0-0" },
      });
      return getRes.ok || getRes.status === 206;
    }
    return false;
  } catch {
    return false;
  }
}

async function rehostImageForVendor(userId: string, url: string): Promise<string> {
  const ossKey = tryParseManagedOssObjectKey(url);
  if (ossKey) {
    const cfg = readOssEnv();
    if (!("error" in cfg)) {
      const client = await createOssClientFrom(cfg);
      const buf = await ossGetBuffer(client, { key: ossKey });
      if (buf?.byteLength) {
        const ext = ossKey.includes(".") ? ossKey.split(".").pop()! : "png";
        return uploadCanvasUserBuffer({
          userId,
          ext,
          buf,
          contentType: ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png",
        });
      }
    }
  }

  const res = await fetch(url, {
    method: "GET",
    signal: AbortSignal.timeout(45_000),
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`参考图不可达（HTTP ${res.status}），无法传给生图模型`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "image/png";
  const ext = contentType.includes("jpeg")
    ? "jpg"
    : contentType.includes("webp")
      ? "webp"
      : "png";
  return uploadCanvasUserBuffer({ userId, ext, buf, contentType });
}

/** Canvas 生图 · 参考图须厂商可拉取（与电商工具箱 ensurePublicImageUrl 同口径） */
export async function ensureCanvasVendorImageUrl(
  userId: string,
  image: string,
): Promise<string> {
  const trimmed = image.trim();
  if (trimmed.startsWith("data:")) {
    const { buf, contentType, ext } = parseDataUrl(trimmed);
    return uploadCanvasUserBuffer({ userId, ext, buf, contentType });
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    if (await isVendorFetchableHttpUrl(trimmed)) {
      return trimmed;
    }
    return rehostImageForVendor(userId, trimmed);
  }
  throw new Error("不支持的参考图 URL");
}

export async function ensureCanvasVendorImageUrls(
  userId: string,
  urls: string[],
  max = 8,
): Promise<string[]> {
  const out: string[] = [];
  for (const raw of urls.slice(0, max)) {
    const u = String(raw ?? "").trim();
    if (!/^https?:\/\//.test(u) && !u.startsWith("data:")) continue;
    out.push(await ensureCanvasVendorImageUrl(userId, u));
  }
  return out;
}
