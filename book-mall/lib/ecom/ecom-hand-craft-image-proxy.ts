import { assertCanvasUserUploadOssUrl } from "@/lib/canvas/canvas-user-oss-read";

const MAX_BYTES = 30 * 1024 * 1024;

/** 拼版 html2canvas 须同域拉图；仅允许本用户 canvas/user-upload 下的 HTTPS 对象 */
export function assertHandCraftComposeImageUrl(ossUrl: string, userId: string): void {
  assertCanvasUserUploadOssUrl(ossUrl, userId);
}

export async function fetchHandCraftComposeImageBuffer(
  ossUrl: string,
): Promise<{ buf: Buffer; contentType: string }> {
  const r = await fetch(ossUrl.trim(), { method: "GET", cache: "no-store" });
  if (!r.ok) {
    throw new Error(`引用图读取失败（HTTP ${r.status}）`);
  }
  const len = Number(r.headers.get("content-length") ?? "0");
  if (len > MAX_BYTES) {
    throw new Error("引用图过大");
  }
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    throw new Error("引用图过大");
  }
  const contentType = r.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  return { buf, contentType };
}
