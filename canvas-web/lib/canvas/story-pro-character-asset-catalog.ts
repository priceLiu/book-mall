import type {
  StoryProCharacterAssetRecord,
  StoryProCharacterAssetRefRecord,
  StoryProCharacterAudioAssetRecord,
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

/** 与 book-mall resolveCharacterRowAssetRefUrls 一致：同 key + 项目/全局，优先有 refs 的记录 */
function pickAssetForKey(
  assets: StoryProCharacterAssetRecord[],
  characterKey: string,
  projectId?: string | null,
): StoryProCharacterAssetRecord | undefined {
  const k = normalizeStoryProCharacterKey(characterKey);
  const pid = projectId?.trim() || null;
  const matches = assets.filter(
    (a) => normalizeStoryProCharacterKey(a.characterKey) === k,
  );
  if (!matches.length) return undefined;

  const candidates = matches.filter(
    (a) => a.projectId === pid || !a.projectId,
  );
  const pool = candidates.length ? candidates : matches;

  return [...pool].sort((a, b) => {
    const aScoped = a.projectId === pid ? 1 : 0;
    const bScoped = b.projectId === pid ? 1 : 0;
    if (bScoped !== aScoped) return bScoped - aScoped;
    return b.refs.length - a.refs.length;
  })[0];
}

/** 每角色一行 → 资产库多 ref（供分镜 @ 目录） */
export function buildAssetRefsByCharacterKey(
  assets: StoryProCharacterAssetRecord[],
  rows: { key: string; name?: string; assetId?: string; lockedRefIds?: string[] }[],
  projectId?: string | null,
): Record<string, StoryRefImage[]> {
  const out: Record<string, StoryRefImage[]> = {};
  for (const row of rows) {
    const asset = findAssetForCharacterRow(
      assets,
      row.key,
      projectId,
      row.name,
      row.assetId,
    );
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

function pickBestAsset(
  matches: StoryProCharacterAssetRecord[],
  projectId?: string | null,
): StoryProCharacterAssetRecord | undefined {
  if (!matches.length) return undefined;
  const pid = projectId?.trim() || null;
  const candidates = matches.filter(
    (a) => a.projectId === pid || !a.projectId,
  );
  const pool = candidates.length ? candidates : matches;
  return [...pool].sort((a, b) => {
    const aScoped = a.projectId === pid ? 1 : 0;
    const bScoped = b.projectId === pid ? 1 : 0;
    if (bScoped !== aScoped) return bScoped - aScoped;
    return b.refs.length - a.refs.length;
  })[0];
}

export function findAssetForCharacterRow(
  assets: StoryProCharacterAssetRecord[],
  characterKey: string,
  projectId?: string | null,
  displayName?: string,
  assetId?: string | null,
): StoryProCharacterAssetRecord | undefined {
  const id = assetId?.trim();
  if (id) {
    const byId = assets.find((a) => a.id === id);
    if (byId) return byId;
  }

  const byKey = pickAssetForKey(assets, characterKey, projectId);
  if (byKey?.refs.length) return byKey;

  const name = displayName?.trim();
  if (name) {
    const byName = assets.filter((a) => a.displayName.trim() === name);
    const best = pickBestAsset(byName, projectId);
    if (best?.refs.length) return best;
  }

  return byKey ?? (name ? pickBestAsset(
    assets.filter((a) => a.displayName.trim() === name),
    projectId,
  ) : undefined);
}

export function findAudioAssetForCharacterRow(
  assets: StoryProCharacterAudioAssetRecord[],
  characterKey: string,
  projectId?: string | null,
): StoryProCharacterAudioAssetRecord | undefined {
  const k = normalizeStoryProCharacterKey(characterKey);
  const matches = assets.filter(
    (a) => normalizeStoryProCharacterKey(a.characterKey) === k,
  );
  if (!matches.length) return undefined;
  const projectScoped = matches.find((a) => a.projectId === projectId);
  if (projectScoped) return projectScoped;
  return matches.find((a) => !a.projectId) ?? matches[0];
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
