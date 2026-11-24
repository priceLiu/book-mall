/** 从其它页面（如图片处理）带入图片到图片编辑 */
export const ECOM_IMAGE_EDITOR_IMPORT_KEY = "ecom-image-editor-import-url";

export function stashImageEditorImportUrl(url: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(ECOM_IMAGE_EDITOR_IMPORT_KEY, url.trim());
  } catch {
    /* ignore */
  }
}

export function takeImageEditorImportUrl(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ECOM_IMAGE_EDITOR_IMPORT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(ECOM_IMAGE_EDITOR_IMPORT_KEY);
    return raw;
  } catch {
    return null;
  }
}