/** LibTV 图片节点 · 火山私域人像库入库元数据（canvas JSON） */

export type CanvasPortraitKind = "virtual" | "real";

export type CanvasPortraitNodeStatus = "pending" | "active" | "failed";

export type CanvasPortraitNodeFields = {
  portraitKind?: CanvasPortraitKind;
  portraitAssetId?: string;
  portraitAssetUri?: string;
  portraitStatus?: CanvasPortraitNodeStatus;
  portraitGroupId?: string;
  portraitImportMessage?: string;
};

export type PortraitImportUiState = "active" | "pending" | "failed" | "missing";

export function buildPortraitAssetUri(assetId: string): string {
  const id = assetId.trim();
  if (!id) return "";
  return id.startsWith("asset://") ? id : `asset://${id}`;
}

/** 从 portraitAssetUri 或 portraitAssetId 解析 asset:// */
export function resolvePortraitAssetUri(
  data: CanvasPortraitNodeFields | undefined | null,
): string | null {
  const uri = String(data?.portraitAssetUri ?? "").trim();
  if (uri.startsWith("asset://")) return uri;
  const id = String(data?.portraitAssetId ?? "").trim();
  if (!id) return null;
  const built = buildPortraitAssetUri(id);
  return built.startsWith("asset://") ? built : null;
}

export function isPortraitNodeActive(
  data: CanvasPortraitNodeFields | undefined | null,
): boolean {
  return data?.portraitStatus === "active" && Boolean(resolvePortraitAssetUri(data));
}

export function portraitImportUiState(
  data: CanvasPortraitNodeFields | undefined | null,
): PortraitImportUiState {
  if (isPortraitNodeActive(data)) return "active";
  if (data?.portraitStatus === "pending") return "pending";
  if (data?.portraitStatus === "failed") return "failed";
  return "missing";
}

export function portraitAssetRefFromNodeData(
  data: CanvasPortraitNodeFields | undefined | null,
): { url: string; role: "reference_image" } | null {
  if (data?.portraitStatus !== "active") return null;
  const url = resolvePortraitAssetUri(data);
  if (!url) return null;
  return {
    url,
    role: "reference_image",
  };
}
