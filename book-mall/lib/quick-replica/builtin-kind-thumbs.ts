/**
 * 中栏 kind 卡片封面 · 每个子类一条内置占位（走 OSS，与右栏 gallery 同源）。
 * sortOrder 低于 gallery，builtinFirstByKind 会优先命中本文件条目。
 */
import { QR_KINDS_BY_CATEGORY } from "@/lib/quick-replica/qr-kinds";
import type { QrCategory, QrMediaRole, QrTemplateJson } from "@/lib/quick-replica/qr-types";

const OSS = "https://tool-mall.oss-cn-guangzhou.aliyuncs.com/quick-replica/builtin";
const STAMP = "2026-06-22T00:00:00.000Z";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function thumbUrl(category: QrCategory, index: number): string {
  switch (category) {
    case "image":
      return `${OSS}/qr-image-gallery-${pad2((index % 38) + 1)}.webp`;
    case "video":
      return `${OSS}/qr-video-gallery-${pad2((index % 15) + 1)}.webp`;
    case "character":
      return `${OSS}/qr-character-gallery-${pad2((index % 20) + 1)}.webp`;
    case "world":
      return `${OSS}/qr-world-gallery-${pad2((index % 20) + 1)}.webp`;
    case "audio":
      return `${OSS}/qr-image-gallery-${pad2((index % 9) + 1)}.webp`;
    default:
      return `${OSS}/qr-image-gallery-01.webp`;
  }
}

function videoOutputUrl(category: QrCategory, index: number): string | null {
  if (category !== "video") return null;
  const n = (index % 15) + 1;
  return `${OSS}/qr-video-gallery-${pad2(n)}-video.mp4`;
}

function defaultModelKey(category: QrCategory, kind: string, toolKey?: string): string {
  if (toolKey === "motion-sync" || kind === "motion-sync") {
    return "kling-2.6/motion-control";
  }
  if (toolKey === "lip-sync" || kind === "lip-sync") {
    return "kling-2.6/motion-control";
  }
  if (category === "video") return "grok-imagine/image-to-video";
  if (category === "audio") return "audio-placeholder";
  if (kind === "image-upscale") return "topaz/image-upscale";
  if (kind === "edit-image" || toolKey === "edit-image") return "gpt-image-2";
  return "lib-nano-pro";
}

function modelRole(category: QrCategory): QrMediaRole {
  if (category === "video") return "VIDEO";
  if (category === "audio") return "AUDIO";
  return "IMAGE";
}

function buildSlots(
  category: QrCategory,
  kind: string,
  toolKey: string | undefined,
  thumb: string,
  videoOut: string | null,
): QrTemplateJson["reference"]["slots"] {
  if (toolKey === "motion-sync" || kind === "motion-sync") {
    return {
      targetImage: { url: `${OSS}/qr-motion-sync-gallery-01.jpg` },
      referenceVideo: {
        url: `${OSS}/qr-motion-sync-gallery-01-video.mp4`,
      },
    };
  }
  if (kind === "lip-sync" || toolKey === "lip-sync") {
    return {
      targetImage: { url: thumb },
    };
  }
  if (category === "world") {
    return { sceneImages: [{ url: thumb, label: "场景" }] };
  }
  if (kind === "edit-image" || kind === "image-variation" || kind === "image-upscale") {
    return { targetImage: { url: thumb } };
  }
  if (category === "video" && videoOut) {
    return { referenceVideo: { url: videoOut } };
  }
  return {};
}

export function listBuiltinKindThumbTemplates(): QrTemplateJson[] {
  const items: QrTemplateJson[] = [];
  for (const [category, kinds] of Object.entries(QR_KINDS_BY_CATEGORY) as [
    QrCategory,
    (typeof QR_KINDS_BY_CATEGORY)[QrCategory],
  ][]) {
    kinds.forEach((def, index) => {
      const thumb = thumbUrl(category, index);
      const videoOut = videoOutputUrl(category, index);
      const id = `builtin-${category}-${def.id}-thumb`;
      items.push({
        schemaVersion: 1,
        id,
        category,
        kind: def.id,
        toolKey: def.toolKey,
        title: def.label,
        thumbnailUrl: thumb,
        source: "builtin",
        visibility: "public",
        reference: {
          slots: buildSlots(category, def.id, def.toolKey, thumb, videoOut),
          prompt: { text: def.description ?? def.label, locale: "zh" },
          model: {
            role: modelRole(category),
            modelKey: defaultModelKey(category, def.id, def.toolKey),
            params:
              def.toolKey === "motion-sync" || def.id === "motion-sync"
                ? { mode: "std", character_orientation: "video" }
                : {},
          },
        },
        output:
          category === "video" && videoOut
            ? {
                mediaType: "video",
                url: videoOut,
                createdAt: STAMP,
              }
            : undefined,
        sortOrder: 10,
        createdAt: STAMP,
        updatedAt: STAMP,
      });
    });
  }
  return items;
}

/** picsum / example.com 占位 → 同分类 OSS 封面（保留旧 builtin-all 条目时升级 URL） */
export function upgradeLegacyBuiltinThumbUrl(
  t: QrTemplateJson,
  kindIndexByCategory: Map<QrCategory, Map<string, number>>,
): QrTemplateJson {
  const thumb = t.thumbnailUrl?.trim() ?? "";
  const needsUpgrade =
    !thumb ||
    thumb.includes("picsum.photos") ||
    thumb.includes("storage.example.com");
  if (!needsUpgrade) return t;

  const kinds = QR_KINDS_BY_CATEGORY[t.category] ?? [];
  let index = kindIndexByCategory.get(t.category)?.get(t.kind);
  if (index == null) {
    index = kinds.findIndex((k) => k.id === t.kind);
    if (index < 0) index = 0;
  }
  const nextThumb = thumbUrl(t.category, index);
  const videoOut = videoOutputUrl(t.category, index);

  const slots = { ...t.reference.slots };
  if (t.toolKey === "motion-sync" || t.kind === "motion-sync") {
    slots.targetImage = { url: `${OSS}/qr-motion-sync-gallery-01.jpg` };
    slots.referenceVideo = {
      url: `${OSS}/qr-motion-sync-gallery-01-video.mp4`,
    };
  } else if (slots.referenceVideo?.url?.includes("storage.example.com") && videoOut) {
    slots.referenceVideo = { url: videoOut };
  }

  return {
    ...t,
    thumbnailUrl: nextThumb,
    reference: {
      ...t.reference,
      slots,
    },
    output:
      t.category === "video" && videoOut && !t.output?.url
        ? { mediaType: "video", url: videoOut, createdAt: STAMP }
        : t.output,
  };
}

export function normalizeBuiltinQrTemplates(raw: QrTemplateJson[]): QrTemplateJson[] {
  const kindIndexByCategory = new Map<QrCategory, Map<string, number>>();
  for (const [category, kinds] of Object.entries(QR_KINDS_BY_CATEGORY) as [
    QrCategory,
    (typeof QR_KINDS_BY_CATEGORY)[QrCategory],
  ][]) {
    kindIndexByCategory.set(
      category,
      new Map(kinds.map((k, i) => [k.id, i])),
    );
  }

  const thumbs = listBuiltinKindThumbTemplates();
  const thumbByKind = new Map(thumbs.map((t) => [`${t.category}:${t.kind}`, t]));

  const upgraded = raw.map((t) => {
    if (isQrGalleryTemplate(t)) return t;
    return upgradeLegacyBuiltinThumbUrl(t, kindIndexByCategory);
  });

  const covered = new Set(upgraded.map((t) => `${t.category}:${t.kind}`));
  for (const thumb of thumbs) {
    const key = `${thumb.category}:${thumb.kind}`;
    if (!covered.has(key)) upgraded.push(thumb);
  }

  return upgraded.sort(
    (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title),
  );
}

function isQrGalleryTemplate(t: Pick<QrTemplateJson, "id">): boolean {
  return (
    t.id.startsWith("qr-image-gallery-") ||
    t.id.startsWith("qr-video-gallery-") ||
    t.id.startsWith("qr-character-gallery-") ||
    t.id.startsWith("qr-world-gallery-") ||
    t.id.startsWith("qr-motion-sync-gallery-")
  );
}
