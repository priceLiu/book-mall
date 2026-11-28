"use client";

import { ecomBookFetch } from "@/lib/ecom-book-fetch";
import { announceEcomCreditsConsumed } from "@/lib/ecom-credits-settlement-watch";
import type { ColorAdjust } from "@/lib/image-editor-color-adjust";

/** 像素调色。https 原图交给服务端读取，本地 blob / data 直接上传文件。 */
export async function submitImageEditorLocalGrade(
  imageUrl: string,
  gradeId: string,
  adjust?: ColorAdjust | null,
): Promise<string> {
  const form = new FormData();
  form.set("grade", gradeId);
  if (adjust) form.set("adjust", JSON.stringify(adjust));
  if (imageUrl.startsWith("https://")) {
    form.set("imageUrl", imageUrl);
  } else {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error("读取图片失败");
    const blob = await res.blob();
    const type = blob.type.startsWith("image/") ? blob.type : "image/jpeg";
    form.set("file", new File([blob], "source.jpg", { type }));
  }
  const data = await ecomBookFetch("api/sso/tools/ecom/image-processing/clear-grade", {
    method: "POST",
    body: form,
  });
  const url = typeof data.imageUrl === "string" ? data.imageUrl.trim() : "";
  if (!url) throw new Error("未返回结果");
  announceEcomCreditsConsumed(data);
  return url;
}
