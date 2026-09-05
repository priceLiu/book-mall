"use client";

import { uploadCanvasImage } from "@/lib/canvas-api";

/** 将 blob: 参考图转为 OSS HTTPS，供 img2img 提交 Gateway */
export async function materializeImageInputsForRun(
  base: string,
  urls: string[],
): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    const u = urls[i]?.trim();
    if (!u) continue;
    if (/^https?:\/\//.test(u)) {
      if (!out.includes(u)) out.push(u);
      continue;
    }
    if (!u.startsWith("blob:")) continue;
    const blob = await fetch(u).then((r) => r.blob());
    const file = new File([blob], `canvas-ref-${Date.now()}-${i}.jpg`, {
      type: blob.type || "image/jpeg",
    });
    const oss = await uploadCanvasImage(base, file);
    if (oss?.trim() && !out.includes(oss.trim())) out.push(oss.trim());
  }
  return out;
}
