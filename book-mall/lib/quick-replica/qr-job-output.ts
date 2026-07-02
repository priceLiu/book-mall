import { extractKieResultUrl, type KieRecordResponse } from "@/lib/story/kie-client";

/** 从 GatewayRequestLog.resultSummary 解析媒体输出 URL（兼容多种终态结构） */
export function extractQrJobOutputUrl(resultSummary: unknown): {
  url: string;
  mediaType: "image" | "video" | "audio";
} | null {
  if (!resultSummary || typeof resultSummary !== "object") return null;
  const root = resultSummary as Record<string, unknown>;

  if (typeof root.audio_url === "string" && root.audio_url.trim()) {
    return { url: root.audio_url.trim(), mediaType: "audio" };
  }
  if (typeof root.video_url === "string" && root.video_url.trim()) {
    return { url: root.video_url.trim(), mediaType: "video" };
  }
  if (typeof root.image_url === "string" && root.image_url.trim()) {
    return { url: root.image_url.trim(), mediaType: "image" };
  }
  if (typeof root.url === "string" && root.url.trim()) {
    const url = root.url.trim();
    const mediaType = /\.(mp3|wav|m4a|aac|ogg)(\?|$)/i.test(url)
      ? "audio"
      : url.includes(".mp4") || url.includes(".webm") || url.includes("video")
        ? "video"
        : "image";
    return { url, mediaType };
  }

  const kieUrl = extractKieResultUrl(root as KieRecordResponse);
  if (kieUrl) {
    const mediaType =
      kieUrl.includes(".mp4") || kieUrl.includes(".webm") || kieUrl.includes("video")
        ? "video"
        : "image";
    return { url: kieUrl, mediaType };
  }

  const data = root.data;
  if (data && typeof data === "object") {
    const nested = extractQrJobOutputUrl(data);
    if (nested) return nested;
    const dataKie = extractKieResultUrl(data as KieRecordResponse);
    if (dataKie) {
      return {
        url: dataKie,
        mediaType:
          dataKie.includes(".mp4") || dataKie.includes(".webm") ? "video" : "image",
      };
    }
  }

  const output = root.output;
  if (output && typeof output === "object") {
    const nested = extractQrJobOutputUrl(output);
    if (nested) return nested;
  }

  return null;
}
