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

const SCENE_HUB_KEY_SEP = "::";

/** 与 book-mall story-pro-scene-asset-service 一致：hub 前缀小写，名称段规范化 */
export function normalizeStoryProSceneKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return "";
  const i = trimmed.indexOf(SCENE_HUB_KEY_SEP);
  if (i > 0) {
    const hub = trimmed.slice(0, i).trim().toLowerCase();
    const namePart = trimmed.slice(i + SCENE_HUB_KEY_SEP.length).trim();
    const name = namePart.toLowerCase().replace(/\s+/g, "-").slice(0, 80);
    return name ? `${hub}${SCENE_HUB_KEY_SEP}${name}` : hub;
  }
  return trimmed.toLowerCase().replace(/\s+/g, "-").slice(0, 80);
}

export function sceneRowHubIdFromKey(key: string): string | null {
  const i = key.indexOf(SCENE_HUB_KEY_SEP);
  if (i <= 0) return null;
  return key.slice(0, i);
}

/** 仅当本行在画布上已有生成/参考记录时，才允许匹配升级前无 hub 前缀的项目场景资产 */
export function sceneRowAllowsLegacyAssetLookup(row: {
  key: string;
  runtime?: { ossUrl?: string; ephemeralUrl?: string } | null;
  refImages?: unknown[] | null;
}): boolean {
  if (row.runtime?.ossUrl?.trim() || row.runtime?.ephemeralUrl?.trim()) {
    return true;
  }
  if (row.refImages?.length) return true;
  return !row.key.includes(SCENE_HUB_KEY_SEP);
}

/** 多工作流画布：场景行 / 资产库 key 须带所属故事剧本 hub，避免同名场景串图 */
export function storyProSceneRowKey(
  scriptHubId: string,
  sceneName: string,
): string {
  const hub = scriptHubId.trim();
  const name = sceneName.trim() || "scene";
  if (!hub) return normalizeStoryProSceneKey(name);
  return normalizeStoryProSceneKey(`${hub}${SCENE_HUB_KEY_SEP}${name}`);
}

/** 解析 lookup 用的 key 列表；有 hub 时禁止回落到无 hub 前缀的旧资产 */
export function sceneAssetLookupKeys(
  sceneKeyOrName: string,
  scriptHubId?: string | null,
): string[] {
  const raw = sceneKeyOrName.trim();
  if (!raw) return [];
  if (raw.includes(SCENE_HUB_KEY_SEP)) return [raw];
  const hub = scriptHubId?.trim();
  if (hub) return [storyProSceneRowKey(hub, raw)];
  return [normalizeStoryProSceneKey(raw)];
}

export function storyProSceneRefMentionId(
  assetId: string,
  refId: string,
): string {
  return `ref-scene-asset-${assetId}-${refId}`;
}

function pickFromMatches(
  matches: StoryProSceneAssetRecord[],
  projectId?: string | null,
): StoryProSceneAssetRecord | undefined {
  if (!matches.length) return undefined;
  return (
    matches.find((a) => a.projectId === projectId) ??
    matches.find((a) => !a.projectId) ??
    matches[0]
  );
}

function pickSceneAsset(
  assets: StoryProSceneAssetRecord[],
  sceneKey: string,
  projectId?: string | null,
  scriptHubId?: string | null,
  sceneName?: string | null,
  allowLegacy?: boolean,
): StoryProSceneAssetRecord | undefined {
  for (const lookupKey of sceneAssetLookupKeys(sceneKey, scriptHubId)) {
    const normalized = normalizeStoryProSceneKey(lookupKey);
    const matches = assets.filter(
      (a) => normalizeStoryProSceneKey(a.sceneKey) === normalized,
    );
    const hit = pickFromMatches(matches, projectId);
    if (hit) return hit;
  }

  if (!allowLegacy) return undefined;

  const hub = scriptHubId?.trim();
  const name = (sceneName ?? "").trim();
  if (!hub || !name) return undefined;
  const legacyKey = normalizeStoryProSceneKey(name);
  const legacyMatches = assets.filter(
    (a) =>
      !a.sceneKey.includes(SCENE_HUB_KEY_SEP) &&
      (a.sceneKey === legacyKey ||
        normalizeStoryProSceneKey(a.sceneKey) === legacyKey),
  );
  return pickFromMatches(legacyMatches, projectId);
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
  rows: {
    key: string;
    name?: string;
    runtime?: { ossUrl?: string; ephemeralUrl?: string } | null;
    refImages?: unknown[] | null;
  }[],
  projectId?: string | null,
  scriptHubId?: string | null,
): Record<string, StoryRefImage[]> {
  const out: Record<string, StoryRefImage[]> = {};
  for (const row of rows) {
    const asset = pickSceneAsset(
      assets,
      row.key,
      projectId,
      scriptHubId,
      row.name,
      sceneRowAllowsLegacyAssetLookup(row),
    );
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
  scriptHubId?: string | null,
  sceneName?: string | null,
  allowLegacy?: boolean,
): StoryProSceneAssetRecord | undefined {
  return pickSceneAsset(
    assets,
    sceneKey,
    projectId,
    scriptHubId,
    sceneName,
    allowLegacy,
  );
}

/** 将旧版 plain key 迁移为 hub 隔离 key（始终规范化，避免 hub 大小写不一致丢 runtime） */
export function migrateSceneRowToHubKey(
  row: { key: string; name: string },
  scriptHubId: string,
): string {
  const hub = scriptHubId.trim();
  const name = row.name.trim();
  if (!hub) return normalizeStoryProSceneKey(name || row.key);
  return storyProSceneRowKey(hub, name || row.key);
}

export function sceneRowKeysEquivalent(a: string, b: string): boolean {
  return normalizeStoryProSceneKey(a) === normalizeStoryProSceneKey(b);
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
