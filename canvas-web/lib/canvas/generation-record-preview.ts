import type { CanvasGenerationRecord } from "@/lib/canvas-api";
import {
  pickTaskImagePreviewUrl,
  pickTaskResultMediaUrl,
  pickTaskVideoUrl,
} from "@/lib/canvas/task-media-url";

export type GenerationRecordMediaItem = {
  url: string;
  kind: "image" | "video";
  label: string;
};

export type GenerationRecordPreview = {
  thumbnailUrl: string | null;
  previewUrl: string | null;
  previewKind: "image" | "video" | null;
  previewMedia: GenerationRecordMediaItem[];
};

function referenceLabel(index: number, total: number): string {
  if (total <= 1) return "参考图";
  if (index === 0) return "首帧";
  return `参考 ${index + 1}`;
}

function dedupeMedia(items: GenerationRecordMediaItem[]): GenerationRecordMediaItem[] {
  const seen = new Set<string>();
  const out: GenerationRecordMediaItem[] = [];
  for (const item of items) {
    const u = item.url.trim();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push({ ...item, url: u });
  }
  return out;
}

function fallbackMediaFromRecord(item: CanvasGenerationRecord): GenerationRecordMediaItem[] {
  const media: GenerationRecordMediaItem[] = [];

  const videoUrl = pickTaskVideoUrl(item);
  if (videoUrl) {
    media.push({ url: videoUrl, kind: "video", label: "生成视频" });
  }

  const imageUrl = pickTaskImagePreviewUrl(item);
  if (imageUrl) {
    media.push({ url: imageUrl, kind: "image", label: "生成图" });
  } else {
    const resultUrl = pickTaskResultMediaUrl(item);
    if (resultUrl) {
      const isVideo =
        /\.mp4(\?|#|$)/i.test(resultUrl) || resultUrl.includes("/node-video/");
      media.push({
        url: resultUrl,
        kind: isVideo ? "video" : "image",
        label: isVideo ? "生成视频" : "生成图",
      });
    }
  }

  const refUrls: string[] = [];
  if (typeof item.mainFrameImageUrl === "string" && item.mainFrameImageUrl.trim()) {
    refUrls.push(item.mainFrameImageUrl.trim());
  }
  if (Array.isArray(item.referenceImageUrls)) {
    for (const u of item.referenceImageUrls) {
      if (typeof u === "string" && u.trim() && !refUrls.includes(u.trim())) {
        refUrls.push(u.trim());
      }
    }
  }

  refUrls.forEach((url, i) => {
    media.push({ url, kind: "image", label: referenceLabel(i, refUrls.length) });
  });

  return dedupeMedia(media);
}

/** 优先用 API 下发的 previewMedia；旧接口回退本地推断。 */
export function resolveGenerationRecordPreview(
  item: CanvasGenerationRecord,
): GenerationRecordPreview {
  if (Array.isArray(item.previewMedia) && item.previewMedia.length > 0) {
    const previewMedia = dedupeMedia(
      item.previewMedia.map((m) => ({
        url: m.url,
        kind: m.kind,
        label: m.label || "图片",
      })),
    );
    const first = previewMedia[0];
    return {
      thumbnailUrl: item.thumbnailUrl ?? first?.url ?? null,
      previewUrl: item.previewUrl ?? first?.url ?? null,
      previewKind: item.previewKind ?? first?.kind ?? null,
      previewMedia,
    };
  }

  const previewMedia = fallbackMediaFromRecord(item);
  const first = previewMedia[0];
  return {
    thumbnailUrl: first?.url ?? null,
    previewUrl: first?.url ?? null,
    previewKind: first?.kind ?? null,
    previewMedia,
  };
}

export function resolveGenerationRecordMedia(
  item: CanvasGenerationRecord,
): GenerationRecordMediaItem[] {
  return resolveGenerationRecordPreview(item).previewMedia;
}
