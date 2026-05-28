import sharp from "sharp";
import type { StoryProCharacterAssetRefKind } from "@prisma/client";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import {
  AUTO_CROP_SLOT_LABELS,
  AUTO_FILL_KINDS,
  THREE_VIEW_AUTO_CROP_REGIONS,
  type AutoCropSlotKind,
} from "@/lib/canvas/story-pro-character-asset-auto-crop";
import {
  listStoryProCharacterAssets,
  normalizeStoryProCharacterKey,
  upsertStoryProCharacterAssetRef,
  type StoryProCharacterAssetRecord,
} from "@/lib/canvas/story-pro-character-asset-service";

const MAX_IMAGE_BYTES = 30 * 1024 * 1024;

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const r = await fetch(url, { method: "GET" });
  if (!r.ok) {
    throw new Error(`无法下载三视图：HTTP ${r.status}`);
  }
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("三视图文件过大，无法裁切");
  }
  if (buf.byteLength < 64) {
    throw new Error("三视图数据无效");
  }
  return buf;
}

async function cropRegion(
  source: Buffer,
  imgW: number,
  imgH: number,
  region: { x: number; y: number; w: number; h: number },
): Promise<Buffer> {
  const left = Math.max(0, Math.round(region.x * imgW));
  const top = Math.max(0, Math.round(region.y * imgH));
  const width = Math.min(imgW - left, Math.max(1, Math.round(region.w * imgW)));
  const height = Math.min(
    imgH - top,
    Math.max(1, Math.round(region.h * imgH)),
  );
  return sharp(source)
    .extract({ left, top, width, height })
    .jpeg({ quality: 92 })
    .toBuffer();
}

function latestRefForKind(
  asset: StoryProCharacterAssetRecord,
  kind: StoryProCharacterAssetRefKind,
) {
  const matches = asset.refs.filter((r) => r.kind === kind);
  if (!matches.length) return undefined;
  return matches.sort((a, b) => b.sortOrder - a.sortOrder)[0];
}

export type AutoFillFromThreeViewResult = {
  filled: AutoCropSlotKind[];
  skipped: AutoCropSlotKind[];
  asset: StoryProCharacterAssetRecord;
};

/** 服务端裁切三视图 → 填入空的脸 / 全身 / 服装槽（绕过浏览器 CORS） */
export async function autoFillCharacterSlotsFromThreeView(
  userId: string,
  args: {
    characterKey: string;
    displayName: string;
    projectId?: string | null;
    threeViewUrl: string;
    sourceTaskId?: string | null;
    onlyEmpty?: boolean;
  },
): Promise<AutoFillFromThreeViewResult> {
  const onlyEmpty = args.onlyEmpty !== false;
  const characterKey = normalizeStoryProCharacterKey(args.characterKey);
  const threeViewUrl = args.threeViewUrl.trim();
  if (!characterKey || !/^https?:\/\//.test(threeViewUrl)) {
    throw new Error("characterKey 与 threeViewUrl 无效");
  }

  const sourceBuf = await fetchImageBuffer(threeViewUrl);
  const meta = await sharp(sourceBuf).metadata();
  const imgW = meta.width ?? 0;
  const imgH = meta.height ?? 0;
  if (imgW < 8 || imgH < 8) {
    throw new Error("无法解析三视图尺寸");
  }

  let asset =
    (await listStoryProCharacterAssets(userId, {
      projectId: args.projectId,
    }).then((list) =>
      list.find(
        (a) =>
          normalizeStoryProCharacterKey(a.characterKey) === characterKey &&
          (a.projectId === (args.projectId?.trim() || null) || !a.projectId),
      ),
    )) ?? null;

  const filled: AutoCropSlotKind[] = [];
  const skipped: AutoCropSlotKind[] = [];

  for (const kind of AUTO_FILL_KINDS) {
    if (onlyEmpty && asset && latestRefForKind(asset, kind)) {
      skipped.push(kind);
      continue;
    }

    const cropped = await cropRegion(
      sourceBuf,
      imgW,
      imgH,
      THREE_VIEW_AUTO_CROP_REGIONS[kind],
    );
    const ossUrl = await uploadCanvasUserBuffer({
      buf: cropped,
      contentType: "image/jpeg",
      userId,
      ext: "jpg",
    });

    asset = await upsertStoryProCharacterAssetRef(userId, {
      characterKey,
      displayName: args.displayName.trim(),
      projectId: args.projectId ?? null,
      kind,
      ossUrl,
      label: `${args.displayName.trim()} · ${AUTO_CROP_SLOT_LABELS[kind]}（自动裁切）`,
      sourceTaskId: args.sourceTaskId ?? null,
    });
    filled.push(kind);
  }

  if (!asset) {
    throw new Error("裁切完成但未找到资产记录");
  }

  return { filled, skipped, asset };
}
