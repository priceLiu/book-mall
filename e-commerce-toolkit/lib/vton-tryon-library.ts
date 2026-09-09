/** 电商模特试衣 · 独立试衣库（与工具站试衣间无关） */
export const ECOM_VTON_TRYON_LIBRARY_PATH = "/library/tryon";

export const ECOM_VTON_TRYON_ASSET_MODULE = "model-tryon";

export function openVtonTryonLibrary(opts?: { newTab?: boolean }): void {
  if (opts?.newTab) {
    window.open(ECOM_VTON_TRYON_LIBRARY_PATH, "_blank", "noopener,noreferrer");
    return;
  }
  window.location.assign(ECOM_VTON_TRYON_LIBRARY_PATH);
}
