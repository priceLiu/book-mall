"use client";

import { uploadCanvasFile } from "@/lib/canvas-api";

/** 剧本创作大文本上传 OSS（冻结档案 / 批次成品） */
export async function uploadScriptStudioTextToOss(
  markdown: string,
  filename: string,
): Promise<string | null> {
  try {
    const base =
      typeof window !== "undefined"
        ? window.location.origin
        : "";
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const file = new File([blob], filename, { type: "text/markdown" });
    const { ossUrl } = await uploadCanvasFile(base, file);
    return ossUrl ?? null;
  } catch {
    return null;
  }
}
