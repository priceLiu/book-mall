import type {
  StoryProCharacterAssetRecord,
  StoryProCharacterAssetRefRecord,
} from "@/lib/canvas-api";
import { normalizeStoryProCharacterKey } from "@/lib/canvas/story-pro-character-key";
import type { StoryRefImage } from "@/lib/canvas/story-ref-image";

export const STORY_PRO_ASSET_REF_KINDS = [
  "face",
  "full_body",
  "outfit",
  "three_view",
] as const;

export type StoryProAssetRefKind = (typeof STORY_PRO_ASSET_REF_KINDS)[number];

export const STORY_PRO_ASSET_REF_KIND_LABELS: Record<
  StoryProAssetRefKind,
  string
> = {
  face: "脸",
  full_body: "全身",
  outfit: "服装",
  three_view: "三视图",
};

export function storyProAssetRefMentionId(
  assetId: string,
  refId: string,
): string {
  return `ref-asset-${assetId}-${refId}`;
}

export function assetRefToStoryRefImage(
  asset: StoryProCharacterAssetRecord,
  ref: StoryProCharacterAssetRefRecord,
): StoryRefImage {
  const kindLabel = STORY_PRO_ASSET_REF_KIND_LABELS[ref.kind];
  return {
    id: storyProAssetRefMentionId(asset.id, ref.id),
    label: ref.label ?? `${asset.displayName} · ${kindLabel}`,
    url: ref.ossUrl,
  };
}

function pickAssetForKey(
  assets: StoryProCharacterAssetRecord[],
  characterKey: string,
  projectId?: string | null,
): StoryProCharacterAssetRecord | undefined {
  const k = normalizeStoryProCharacterKey(characterKey);
  const matches = assets.filter(
    (a) => normalizeStoryProCharacterKey(a.characterKey) === k,
  );
  if (!matches.length) return undefined;
  const projectScoped = matches.find((a) => a.projectId === projectId);
  if (projectScoped) return projectScoped;
  return matches.find((a) => !a.projectId) ?? matches[0];
}

/** 每角色一行 → 资产库多 ref（供分镜 @ 目录） */
export function buildAssetRefsByCharacterKey(
  assets: StoryProCharacterAssetRecord[],
  rows: { key: string; lockedRefIds?: string[] }[],
  projectId?: string | null,
): Record<string, StoryRefImage[]> {
  const out: Record<string, StoryRefImage[]> = {};
  for (const row of rows) {
    const asset = pickAssetForKey(assets, row.key, projectId);
    if (!asset?.refs.length) continue;

    let refs = [...asset.refs].sort((a, b) => a.sortOrder - b.sortOrder);
    if (row.lockedRefIds?.length) {
      const locked = new Set(row.lockedRefIds);
      refs = refs.filter((r) => locked.has(r.id));
    } else {
      const byKind = new Map<string, StoryProCharacterAssetRefRecord>();
      for (const r of refs) {
        const prev = byKind.get(r.kind);
        if (!prev || r.sortOrder >= prev.sortOrder) byKind.set(r.kind, r);
      }
      refs = STORY_PRO_ASSET_REF_KINDS.map((k) => byKind.get(k)).filter(
        (r): r is StoryProCharacterAssetRefRecord => Boolean(r),
      );
    }

    if (refs.length) {
      out[row.key] = refs.map((r) => assetRefToStoryRefImage(asset, r));
    }
  }
  return out;
}

export function findAssetForCharacterRow(
  assets: StoryProCharacterAssetRecord[],
  characterKey: string,
  projectId?: string | null,
): StoryProCharacterAssetRecord | undefined {
  return pickAssetForKey(assets, characterKey, projectId);
}

export function latestRefForKind(
  asset: StoryProCharacterAssetRecord | undefined,
  kind: StoryProAssetRefKind,
): StoryProCharacterAssetRefRecord | undefined {
  if (!asset?.refs.length) return undefined;
  const kindRefs = asset.refs
    .filter((r) => r.kind === kind)
    .sort((a, b) => b.sortOrder - a.sortOrder);
  return kindRefs[0];
}
