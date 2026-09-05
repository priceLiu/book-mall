"use client";

export type ImportPoseFromImageBody = {
  imageUrl: string;
  savePrompt: boolean;
  prompt?: string;
  category?: string;
  sourceModule?: string;
  sourceAssetId?: string;
};

export type ImportPoseFromImageResult =
  | { ok: true; entry: { id: string; title: string } }
  | { ok: false; status: number; error: string; existingTitle?: string };

/** 经同域 BFF 调用 book-mall 管理员入库 API */
export async function importPoseToLibraryAdmin(
  body: ImportPoseFromImageBody,
): Promise<ImportPoseFromImageResult> {
  const res = await fetch("/api/book-mall/api/admin/ecom/pose-library/import-from-image", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    existingTitle?: string;
    entry?: { id: string; title: string };
  };
  if (res.status === 409) {
    return {
      ok: false,
      status: 409,
      error: data.error ?? "该图片已在姿势库中",
      existingTitle: data.existingTitle,
    };
  }
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: data.error ?? `入库失败 (${res.status})`,
    };
  }
  return { ok: true, entry: data.entry! };
}
