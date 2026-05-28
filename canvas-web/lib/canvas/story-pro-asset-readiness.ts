/**
 * 影视专业版 · 角色资产完备度（P-A4 / P-B2）
 */

import type { StoryProCharacterAssetRecord } from "@/lib/canvas-api";
import { findAssetForCharacterRow } from "@/lib/canvas/story-pro-character-asset-catalog";
import { matchCharactersInFrameText } from "@/lib/canvas/story-pro-frame-ref-suggest";

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
  characterRefSnapshotAt?: string;
  characterAssetVersions?: Record<string, number>;
  characterRefIds?: string[];
};

function characterReadiness(
  name: string,
  key: string,
  asset: StoryProCharacterAssetRecord | undefined,
): CharacterAssetReadiness {
  if (!asset?.refs.length) {
    return { key, name, level: "missing", hasThreeView: false };
  }
  const hasThreeView = asset.refs.some((r) => r.kind === "three_view");
  const hasFace = asset.refs.some((r) => r.kind === "face");
  if (hasThreeView) {
    return {
      key,
      name,
      level: hasFace ? "ready" : "partial",
      hasThreeView: true,
      assetVersion: asset.version,
    };
  }
  return {
    key,
    name,
    level: "partial",
    hasThreeView: false,
    assetVersion: asset.version,
  };
}

export function assessFrameRowAssetReadiness(
  row: FrameRowLike,
  characterRows: { key: string; name: string }[],
  assets: StoryProCharacterAssetRecord[],
  projectId?: string | null,
): FrameRowAssetReadiness {
  const text = [row.dialogue, row.description, row.scene].join("\n");
  const matched = matchCharactersInFrameText(text, characterRows);
  if (!matched.length) {
    return { level: "none", characters: [] };
  }
  const characters = matched.map((c) =>
    characterReadiness(
      c.name,
      c.key,
      findAssetForCharacterRow(assets, c.key, projectId),
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
