/**
 * 影视专业版 · 角色资产完备度（P-A4 / P-B2）
 */

import type { StoryProCharacterAssetRecord } from "@/lib/canvas-api";
import {
  findAssetForCharacterRow,
  storyProAssetRefMentionId,
} from "@/lib/canvas/story-pro-character-asset-catalog";
import { normalizeStoryProCharacterKey } from "@/lib/canvas/story-pro-character-key";
import { matchCharactersInFrameText } from "@/lib/canvas/story-pro-frame-ref-suggest";
import {
  storyRefIdsFromPrompt,
} from "@/lib/canvas/story-ref-image";
import type { StoryRefImage } from "@/lib/canvas/story-ref-image";
import { charactersInFrameScript } from "@/lib/canvas/story-column-sync";

export type AssetReadinessLevel = "ready" | "partial" | "missing" | "none";

export type CharacterAssetReadiness = {
  key: string;
  name: string;
  level: AssetReadinessLevel;
  hasThreeView: boolean;
  assetVersion?: number;
};

export type FrameRowAssetReadiness = {
  level: AssetReadinessLevel;
  characters: CharacterAssetReadiness[];
};

type FrameRowLike = {
  dialogue?: string;
  description?: string;
  scene?: string;
  prompt?: string;
  refImages?: StoryRefImage[];
  characterRefSnapshotAt?: string;
  characterAssetVersions?: Record<string, number>;
  characterRefIds?: string[];
};

type CharacterRowForReadiness = {
  key: string;
  name: string;
  assetId?: string;
  runtime?: { ossUrl?: string; ephemeralUrl?: string };
};

function hasGeneratedThreeView(
  runtime?: { ossUrl?: string; ephemeralUrl?: string },
): boolean {
  const url = runtime?.ossUrl ?? runtime?.ephemeralUrl;
  return Boolean(url && /^https?:\/\//.test(url));
}

function characterReadiness(
  name: string,
  key: string,
  asset: StoryProCharacterAssetRecord | undefined,
  runtime?: { ossUrl?: string; ephemeralUrl?: string },
  catalogRefs?: StoryRefImage[],
): CharacterAssetReadiness {
  const hasThreeViewFromAsset = Boolean(
    asset?.refs.some((r) => r.kind === "three_view"),
  );
  const hasThreeViewFromRuntime = hasGeneratedThreeView(runtime);
  const hasThreeViewFromCatalog = Boolean(
    catalogRefs?.some((r) => r.url && /^https?:\/\//.test(r.url)),
  );
  const hasAnyCatalogRef = Boolean(
    catalogRefs?.some((r) => r.url && /^https?:\/\//.test(r.url)),
  );
  const hasThreeView =
    hasThreeViewFromAsset ||
    hasThreeViewFromRuntime ||
    hasThreeViewFromCatalog;

  if (!asset?.refs.length && !hasThreeViewFromRuntime && !hasAnyCatalogRef) {
    return { key, name, level: "missing", hasThreeView: false };
  }

  if (hasThreeView) {
    return {
      key,
      name,
      level: "ready",
      hasThreeView: true,
      assetVersion: asset?.version,
    };
  }
  return {
    key,
    name,
    level: "partial",
    hasThreeView: false,
    assetVersion: asset?.version,
  };
}

function matchCharactersForFrameRow(
  row: FrameRowLike,
  characterRows: CharacterRowForReadiness[],
  assets: StoryProCharacterAssetRecord[],
): CharacterRowForReadiness[] {
  const text = [row.dialogue, row.description, row.scene, row.prompt]
    .filter(Boolean)
    .join("\n");
  const matched = matchCharactersInFrameText(text, characterRows);
  const seen = new Set(matched.map((c) => c.key));
  for (const c of charactersInFrameScript(
    {
      scene: row.scene ?? "",
      description: row.description ?? "",
      dialogue: row.dialogue ?? "",
    },
    characterRows,
  )) {
    if (!seen.has(c.key)) {
      seen.add(c.key);
      matched.push(c);
    }
  }

  const prompt = row.prompt ?? "";
  for (const refId of storyRefIdsFromPrompt(prompt)) {
    if (refId.startsWith("ref-char-")) {
      const charKey = refId.slice("ref-char-".length);
      const rowHit = characterRows.find((c) => c.key === charKey);
      if (rowHit && !seen.has(rowHit.key)) {
        seen.add(rowHit.key);
        matched.push(rowHit);
      }
      continue;
    }
    if (!refId.startsWith("ref-asset-")) continue;
    for (const asset of assets) {
      const rowHit = characterRows.find(
        (c) =>
          normalizeStoryProCharacterKey(c.key) ===
          normalizeStoryProCharacterKey(asset.characterKey),
      );
      if (!rowHit || seen.has(rowHit.key)) continue;
      const hit = asset.refs.some(
        (ref) => storyProAssetRefMentionId(asset.id, ref.id) === refId,
      );
      if (hit) {
        seen.add(rowHit.key);
        matched.push(rowHit);
        break;
      }
    }
  }

  return matched;
}

export function assessFrameRowAssetReadiness(
  row: FrameRowLike,
  characterRows: CharacterRowForReadiness[],
  assets: StoryProCharacterAssetRecord[],
  projectId?: string | null,
  assetRefsByKey?: Record<string, StoryRefImage[]>,
): FrameRowAssetReadiness {
  const matched = matchCharactersForFrameRow(row, characterRows, assets);
  if (!matched.length) {
    return { level: "none", characters: [] };
  }
  const rowRefByCharKey = new Map<string, StoryRefImage[]>();
  for (const ref of row.refImages ?? []) {
    if (ref.id.startsWith("ref-char-")) {
      const k = ref.id.slice("ref-char-".length);
      rowRefByCharKey.set(k, [...(rowRefByCharKey.get(k) ?? []), ref]);
    }
  }
  const characters = matched.map((c) =>
    characterReadiness(
      c.name,
      c.key,
      findAssetForCharacterRow(
        assets,
        c.key,
        projectId,
        c.name,
        c.assetId,
      ),
      c.runtime,
      [
        ...(assetRefsByKey?.[c.key] ?? []),
        ...(rowRefByCharKey.get(c.key) ?? []),
      ],
    ),
  );
  if (characters.every((c) => c.level === "ready")) {
    return { level: "ready", characters };
  }
  if (characters.some((c) => c.level === "missing")) {
    return { level: "missing", characters };
  }
  return { level: "partial", characters };
}

/** 分镜行 ref 快照是否落后于资产库 version（P-B2） */
export function frameRowHasStaleAssetSnapshot(
  row: FrameRowLike,
  assets: StoryProCharacterAssetRecord[],
  projectId?: string | null,
): boolean {
  const versions = row.characterAssetVersions;
  if (!versions || !Object.keys(versions).length) return false;
  for (const [key, snapVersion] of Object.entries(versions)) {
    const asset = findAssetForCharacterRow(assets, key, projectId);
    if (asset && asset.version > snapVersion) return true;
  }
  return false;
}

export function buildCharacterRefSnapshot(
  refIds: string[],
  assets: StoryProCharacterAssetRecord[],
  _characterRows: { key: string }[],
  _projectId?: string | null,
): {
  characterRefSnapshotAt: string;
  characterAssetVersions: Record<string, number>;
  characterRefIds: string[];
} {
  const characterAssetVersions: Record<string, number> = {};
  for (const refId of refIds) {
    for (const asset of assets) {
      if (asset.refs.some((r) => refId.includes(r.id))) {
        characterAssetVersions[asset.characterKey] = asset.version ?? 1;
      }
    }
  }
  return {
    characterRefSnapshotAt: new Date().toISOString(),
    characterAssetVersions,
    characterRefIds: [...refIds],
  };
}

export function readinessLabel(level: AssetReadinessLevel): string {
  switch (level) {
    case "ready":
      return "资产就绪";
    case "partial":
      return "资产部分";
    case "missing":
      return "资产缺失";
    default:
      return "";
  }
}

export function readinessDetail(
  level: AssetReadinessLevel,
  characters: CharacterAssetReadiness[],
): string {
  if (level === "none" || !characters.length) return "";
  const parts = characters.map((c) => {
    if (c.level === "ready") return `${c.name}(✓)`;
    if (c.level === "partial") return `${c.name}(~)`;
    return `${c.name}(!)`;
  });
  const missingNames = characters
    .filter((c) => c.level === "missing")
    .map((c) => c.name)
    .join("、");
  const hint =
    level === "missing"
      ? ` · 请在「人物设计」列为 ${missingNames || "上述角色"} 生成三视图（每镜出场角色须各自入库）`
      : level === "partial"
        ? " · 建议补全三视图后再生成"
        : "";
  return `${parts.join(" ")}${hint}`;
}

export function readinessClass(level: AssetReadinessLevel): string {
  switch (level) {
    case "missing":
      return "text-red-400/90";
    case "ready":
      return "text-emerald-300/90";
    case "partial":
      return "text-emerald-200/75";
    default:
      return "text-emerald-200/60";
  }
}
