/**
 * 工具站视频实验室 · KIE Grok 图生视频（经 Gateway，禁止直连 KIE）
 */
import {
  rehostRemoteImageToOss,
  uploadAiFitImageToOss,
} from "@/lib/ai-fit-oss-upload";

const KIE_I2V_MODELS = new Set([
  "grok-imagine/image-to-video",
  "grok-imagine-video-1-5-preview",
]);

export function isKieLabI2vModel(apiModel: string): boolean {
  return KIE_I2V_MODELS.has(apiModel.trim());
}

export function mapLabResolutionToKie(resolution: "720P" | "1080P"): "480p" | "720p" {
  return resolution === "720P" ? "720p" : "720p";
}

function parseDataImageUrl(dataUrl: string): { buffer: Buffer; contentType: string } {
  const trimmed = dataUrl.trim();
  const m = /^data:(image\/[\w+.-]+);base64,(.+)$/i.exec(trimmed);
  if (!m) throw new Error("首帧须为 data:image/…;base64,… 或公网 HTTPS URL");
  return { contentType: m[1]!, buffer: Buffer.from(m[2]!, "base64") };
}

/** KIE Grok 仅接受 HTTPS image_urls；data URL 先上传 OSS。 */
export async function resolveKieI2vFirstFrameUrl(firstFrame: string): Promise<string> {
  const raw = firstFrame.trim();
  if (!raw) throw new Error("缺少首帧图片");

  if (raw.startsWith("data:image/")) {
    const { buffer, contentType } = parseDataImageUrl(raw);
    if (buffer.length > 15 * 1024 * 1024) {
      throw new Error("首帧图片过大，请压缩后重试");
    }
    return uploadAiFitImageToOss(buffer, contentType, "tryon");
  }

  if (/^https:\/\//i.test(raw)) return raw;
  if (/^http:\/\//i.test(raw)) return rehostRemoteImageToOss(raw);

  throw new Error("首帧须为 data:image/…;base64,… 或公网图片 URL");
}

export function clampKieI2vDuration(
  apiModel: string,
  duration: number,
): number {
  const d = Math.floor(duration);
  if (apiModel === "grok-imagine-video-1-5-preview") {
    return Math.min(15, Math.max(1, d));
  }
  if (apiModel === "grok-imagine/image-to-video") {
    return Math.min(30, Math.max(6, d));
  }
  return d;
}
