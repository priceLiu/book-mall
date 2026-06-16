/** 生成记录 · 列表缩略图 / 悬停预览 URL */

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

const VIDEO_EXT = /\.mp4(\?|#|$)/i;
const RASTER_EXT = /\.(png|jpe?g|webp|gif|bmp|avif)(\?|#|$)/i;

function isHttpUrl(raw: unknown): raw is string {
  return typeof raw === "string" && /^https?:\/\//.test(raw.trim());
}

function isLikelyVideoUrl(url: string): boolean {
  const u = url.trim();
  return VIDEO_EXT.test(u) || u.includes("/node-video/");
}

function isLikelyRasterImageUrl(url: string): boolean {
  const u = url.trim();
  if (RASTER_EXT.test(u)) return true;
  return !isLikelyVideoUrl(u) && !/\.(glb|gltf|obj|fbx|stl|usdz)(\?|#|$)/i.test(u);
}

function pickResultImageUrl(args: {
  ossUrl?: string | null;
  ephemeralUrl?: string | null;
}): string | null {
  for (const raw of [args.ossUrl, args.ephemeralUrl]) {
    const u = raw?.trim();
    if (!u || !isHttpUrl(u)) continue;
    if (isLikelyVideoUrl(u)) continue;
    if (isLikelyRasterImageUrl(u)) return u;
  }
  for (const raw of [args.ossUrl, args.ephemeralUrl]) {
    const u = raw?.trim();
    if (u && isHttpUrl(u) && !isLikelyVideoUrl(u)) return u;
  }
  return null;
}

function pickResultVideoUrl(args: {
  ossUrl?: string | null;
  ephemeralUrl?: string | null;
}): string | null {
  for (const raw of [args.ossUrl, args.ephemeralUrl]) {
    const u = raw?.trim();
    if (u && isHttpUrl(u) && isLikelyVideoUrl(u)) return u;
  }
  return null;
}

export function collectGenerationRecordReferenceUrls(
  inputPayload: unknown,
): string[] {
  if (!inputPayload || typeof inputPayload !== "object" || Array.isArray(inputPayload)) {
    return [];
  }
  const p = inputPayload as Record<string, unknown>;
  const out: string[] = [];
  const push = (raw: unknown) => {
    if (isHttpUrl(raw) && isLikelyRasterImageUrl(raw.trim()) && !out.includes(raw.trim())) {
      out.push(raw.trim());
    }
  };

  push(p.mainFrameImageUrl);
  push(p.imageUrl);
  push(p.image_url);

  for (const key of ["referenceImageUrls", "imageUrls", "image_urls", "imageInputs"]) {
    const arr = p[key];
    if (!Array.isArray(arr)) continue;
    for (const item of arr) push(item);
  }

  const input = p.input;
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const nested = input as Record<string, unknown>;
    push(nested.image_url);
    push(nested.imageUrl);
    for (const key of ["image_urls", "imageUrls", "reference_image_urls"]) {
      const arr = nested[key];
      if (!Array.isArray(arr)) continue;
      for (const item of arr) push(item);
    }
  }

  const kieInput = p.kieInput;
  if (kieInput && typeof kieInput === "object" && !Array.isArray(kieInput)) {
    const nested = kieInput as Record<string, unknown>;
    for (const key of ["image_url", "imageUrl", "image_urls", "imageUrls"]) {
      const val = nested[key];
      if (Array.isArray(val)) {
        for (const item of val) push(item);
      } else {
        push(val);
      }
    }
  }

  return out;
}

function referenceLabel(index: number, total: number): string {
  if (total <= 1) return "参考图";
  if (index === 0) return "首帧";
  return `参考 ${index + 1}`;
}

function buildPreviewMedia(args: {
  ossUrl?: string | null;
  ephemeralUrl?: string | null;
  inputPayload?: unknown;
}): GenerationRecordMediaItem[] {
  const media: GenerationRecordMediaItem[] = [];
  const seen = new Set<string>();
  const add = (url: string | null | undefined, kind: "image" | "video", label: string) => {
    const u = url?.trim();
    if (!u || !isHttpUrl(u) || seen.has(u)) return;
    seen.add(u);
    media.push({ url: u, kind, label });
  };

  const videoUrl = pickResultVideoUrl(args);
  if (videoUrl) add(videoUrl, "video", "生成视频");

  const imageUrl = pickResultImageUrl(args);
  if (imageUrl) add(imageUrl, "image", "生成图");

  const refs = collectGenerationRecordReferenceUrls(args.inputPayload);
  refs.forEach((url, i) => add(url, "image", referenceLabel(i, refs.length)));

  return media;
}

export function resolveGenerationRecordPreview(args: {
  ossUrl?: string | null;
  ephemeralUrl?: string | null;
  inputPayload?: unknown;
}): GenerationRecordPreview {
  const previewMedia = buildPreviewMedia(args);
  const first = previewMedia[0];
  return {
    thumbnailUrl: first?.url ?? null,
    previewUrl: first?.url ?? null,
    previewKind: first?.kind ?? null,
    previewMedia,
  };
}
