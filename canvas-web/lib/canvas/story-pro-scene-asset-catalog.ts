import type {
  StoryProSceneAssetRecord,
  StoryProSceneAssetRefRecord,
} from "@/lib/canvas-api";
import type { StoryRefImage } from "@/lib/canvas/story-ref-image";

export const STORY_PRO_SCENE_REF_KINDS = [
  "establishing",
  "detail",
  "mood",
] as const;

export type StoryProSceneRefKind = (typeof STORY_PRO_SCENE_REF_KINDS)[number];

export const STORY_PRO_SCENE_REF_KIND_LABELS: Record<
  StoryProSceneRefKind,
  string
> = {
  establishing: "全景",
  detail: "细节",
  mood: "氛围",
};

export function normalizeStoryProSceneKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 80);
}

export function storyProSceneRefMentionId(
  assetId: string,
  refId: string,
): string {
  return `ref-scene-asset-${assetId}-${refId}`;
}

function pickSceneAsset(
  assets: StoryProSceneAssetRecord[],
  sceneKey: string,
  projectId?: string | null,
): StoryProSceneAssetRecord | undefined {
  const k = normalizeStoryProSceneKey(sceneKey);
  const matches = assets.filter(
    (a) => normalizeStoryProSceneKey(a.sceneKey) === k,
  );
  if (!matches.length) return undefined;
  return (
    matches.find((a) => a.projectId === projectId) ??
    matches.find((a) => !a.projectId) ??
    matches[0]
  );
}

export function assetRefToSceneStoryRefImage(
  asset: StoryProSceneAssetRecord,
  ref: StoryProSceneAssetRefRecord,
): StoryRefImage {
  const kindLabel = STORY_PRO_SCENE_REF_KIND_LABELS[ref.kind];
  return {
    id: storyProSceneRefMentionId(asset.id, ref.id),
    label: ref.label ?? `${asset.displayName} · ${kindLabel}`,
    url: ref.ossUrl,
  };
}

export function buildAssetRefsBySceneKey(
  assets: StoryProSceneAssetRecord[],
  rows: { key: string }[],
  projectId?: string | null,
): Record<string, StoryRefImage[]> {
  const out: Record<string, StoryRefImage[]> = {};
  for (const row of rows) {
    const asset = pickSceneAsset(assets, row.key, projectId);
    if (!asset?.refs.length) continue;
    const byKind = new Map<string, StoryProSceneAssetRefRecord>();
    for (const r of asset.refs) {
      const prev = byKind.get(r.kind);
      if (!prev || r.sortOrder >= prev.sortOrder) byKind.set(r.kind, r);
    }
    const refs = STORY_PRO_SCENE_REF_KINDS.map((k) => byKind.get(k)).filter(
      (r): r is StoryProSceneAssetRefRecord => Boolean(r),
    );
    if (refs.length) {
      out[row.key] = refs.map((r) => assetRefToSceneStoryRefImage(asset, r));
    }
  }
  return out;
}

export function findAssetForSceneRow(
  assets: StoryProSceneAssetRecord[],
  sceneKey: string,
  projectId?: string | null,
): StoryProSceneAssetRecord | undefined {
  return pickSceneAsset(assets, sceneKey, projectId);
}

export function latestSceneRefForKind(
  asset: StoryProSceneAssetRecord | undefined,
  kind: StoryProSceneRefKind,
): StoryProSceneAssetRefRecord | undefined {
  if (!asset?.refs.length) return undefined;
  return asset.refs
    .filter((r) => r.kind === kind)
    .sort((a, b) => b.sortOrder - a.sortOrder)[0];
}

/** 分镜 @ 目录：角色 + 场景资产合并 */
export function mergeFrameRefCatalog(
  characterCatalog: StoryRefImage[],
  sceneCatalog: StoryRefImage[],
): StoryRefImage[] {
  return [...characterCatalog, ...sceneCatalog];
}
