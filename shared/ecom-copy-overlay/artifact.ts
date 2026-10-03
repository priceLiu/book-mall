import type { EcomCopyOverlay } from "./types";
import { ECOM_COPY_OVERLAY_VERSION } from "./types";
import { defaultCopyOverlay, parseEcomCopyOverlay } from "./defaults";

export const ECOM_COPY_IMAGE_ARTIFACT_SCHEMA = "ecom-copy-image-artifact/v1" as const;

export type EcomCopyImageArtifact = {
  schema: typeof ECOM_COPY_IMAGE_ARTIFACT_SCHEMA;
  copy: {
    slotCopy: string;
    slotCopyAi?: string;
  };
  image: {
    baseImageUrl?: string;
    finalImageUrl?: string;
    imagePrompt: string;
    negativePrompt?: string;
  };
  layout: EcomCopyOverlay;
  render: {
    burnCopyInImage: boolean;
    exportWidthPx: number;
    aspectRatio?: string;
  };
  meta?: {
    sourceModule?: string;
    composedAt?: string;
    baseImageAssetId?: string;
    finalImageAssetId?: string;
  };
};

export function createDefaultArtifact(opts: {
  slotCopy?: string;
  slotCopyAi?: string;
  imagePrompt?: string;
  exportWidthPx?: number;
  aspectRatio?: string;
  burnDefault?: boolean;
  baseImageUrl?: string;
  sourceModule?: string;
}): EcomCopyImageArtifact {
  const slotCopy = opts.slotCopy?.trim() ?? "";
  const exportWidthPx = opts.exportWidthPx ?? 750;
  return {
    schema: ECOM_COPY_IMAGE_ARTIFACT_SCHEMA,
    copy: {
      slotCopy,
      ...(opts.slotCopyAi?.trim() ? { slotCopyAi: opts.slotCopyAi.trim() } : {}),
    },
    image: {
      ...(opts.baseImageUrl?.trim() ? { baseImageUrl: opts.baseImageUrl.trim() } : {}),
      imagePrompt: opts.imagePrompt?.trim() ?? "",
    },
    layout: defaultCopyOverlay(slotCopy, exportWidthPx),
    render: {
      burnCopyInImage: opts.burnDefault === true,
      exportWidthPx,
      ...(opts.aspectRatio?.trim() ? { aspectRatio: opts.aspectRatio.trim() } : {}),
    },
    ...(opts.sourceModule?.trim()
      ? { meta: { sourceModule: opts.sourceModule.trim() } }
      : {}),
  };
}

export function parseEcomCopyImageArtifact(raw: unknown): EcomCopyImageArtifact | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if (o.schema !== ECOM_COPY_IMAGE_ARTIFACT_SCHEMA) return undefined;

  const copyRaw = o.copy;
  const slotCopy =
    copyRaw && typeof copyRaw === "object" && typeof (copyRaw as { slotCopy?: unknown }).slotCopy === "string"
      ? String((copyRaw as { slotCopy: string }).slotCopy)
      : "";
  const slotCopyAi =
    copyRaw &&
    typeof copyRaw === "object" &&
    typeof (copyRaw as { slotCopyAi?: unknown }).slotCopyAi === "string"
      ? String((copyRaw as { slotCopyAi: string }).slotCopyAi)
      : undefined;

  const imageRaw = o.image;
  const imagePrompt =
    imageRaw &&
    typeof imageRaw === "object" &&
    typeof (imageRaw as { imagePrompt?: unknown }).imagePrompt === "string"
      ? String((imageRaw as { imagePrompt: string }).imagePrompt)
      : "";
  const baseImageUrl =
    imageRaw &&
    typeof imageRaw === "object" &&
    typeof (imageRaw as { baseImageUrl?: unknown }).baseImageUrl === "string"
      ? String((imageRaw as { baseImageUrl: string }).baseImageUrl).trim()
      : undefined;
  const finalImageUrl =
    imageRaw &&
    typeof imageRaw === "object" &&
    typeof (imageRaw as { finalImageUrl?: unknown }).finalImageUrl === "string"
      ? String((imageRaw as { finalImageUrl: string }).finalImageUrl).trim()
      : undefined;
  const negativePrompt =
    imageRaw &&
    typeof imageRaw === "object" &&
    typeof (imageRaw as { negativePrompt?: unknown }).negativePrompt === "string"
      ? String((imageRaw as { negativePrompt: string }).negativePrompt)
      : undefined;

  const layout =
    parseEcomCopyOverlay(o.layout) ??
    defaultCopyOverlay(slotCopy, 750);

  const renderRaw = o.render;
  const exportWidthPx =
    renderRaw &&
    typeof renderRaw === "object" &&
    Number.isFinite(Number((renderRaw as { exportWidthPx?: unknown }).exportWidthPx))
      ? Math.max(
          320,
          Math.min(4096, Math.round(Number((renderRaw as { exportWidthPx: number }).exportWidthPx))),
        )
      : layout.exportWidthPx ?? 750;
  const burnCopyInImage =
    renderRaw &&
    typeof renderRaw === "object" &&
    (renderRaw as { burnCopyInImage?: unknown }).burnCopyInImage === true;
  const aspectRatio =
    renderRaw &&
    typeof renderRaw === "object" &&
    typeof (renderRaw as { aspectRatio?: unknown }).aspectRatio === "string"
      ? String((renderRaw as { aspectRatio: string }).aspectRatio)
      : undefined;

  return {
    schema: ECOM_COPY_IMAGE_ARTIFACT_SCHEMA,
    copy: { slotCopy, ...(slotCopyAi ? { slotCopyAi } : {}) },
    image: {
      ...(baseImageUrl ? { baseImageUrl } : {}),
      ...(finalImageUrl ? { finalImageUrl } : {}),
      imagePrompt,
      ...(negativePrompt ? { negativePrompt } : {}),
    },
    layout: { ...layout, exportWidthPx, version: ECOM_COPY_OVERLAY_VERSION },
    render: {
      burnCopyInImage: burnCopyInImage === true,
      exportWidthPx,
      ...(aspectRatio ? { aspectRatio } : {}),
    },
    ...(o.meta && typeof o.meta === "object" ? { meta: o.meta as EcomCopyImageArtifact["meta"] } : {}),
  };
}
