/**
 * 分镜行 · 上游 @ 参考图：已出图 / 未出图拆分与提示文案
 */

import { matchCharactersInFrameText } from "@/lib/canvas/story-pro-frame-ref-suggest";
import {
  storyRefImagesFromPrompt,
  type StoryRefImage,
} from "@/lib/canvas/story-ref-image";

export function isStoryRefImageResolved(ref: StoryRefImage): boolean {
  return Boolean(ref.url && /^https?:\/\//.test(ref.url));
}

export function partitionStoryRefImages(refs: StoryRefImage[]): {
  resolved: StoryRefImage[];
  missing: StoryRefImage[];
} {
  const resolved: StoryRefImage[] = [];
  const missing: StoryRefImage[] = [];
  for (const r of refs) {
    if (isStoryRefImageResolved(r)) resolved.push(r);
    else missing.push(r);
  }
  return { resolved, missing };
}

export type FrameUpstreamAssessment = {
  /** 上游参考列仅展示这些（有 OSS URL） */
  resolved: StoryRefImage[];
  /** prompt 中 @ 了但尚无 URL */
  missingRefs: StoryRefImage[];
  hint: string | null;
};

type CharacterRowLike = { key: string; name: string };

type FrameRowLike = {
  dialogue?: string;
  description?: string;
  scene?: string;
  prompt?: string;
};

function characterHasResolvedRef(
  c: CharacterRowLike,
  assetRefsByKey?: Record<string, StoryRefImage[]>,
  catalog?: StoryRefImage[],
): boolean {
  if ((assetRefsByKey?.[c.key] ?? []).some(isStoryRefImageResolved)) {
    return true;
  }
  return (catalog ?? []).some(
    (r) =>
      (r.id === `ref-char-${c.key}` ||
        (r.id.startsWith("ref-asset-") && r.label.includes(c.name))) &&
      isStoryRefImageResolved(r),
  );
}

function missingCharacterNamesInFrame(
  row: FrameRowLike,
  characterRows: CharacterRowLike[],
  assetRefsByKey?: Record<string, StoryRefImage[]>,
  catalog?: StoryRefImage[],
): string[] {
  const matched = matchCharactersInFrameText(
    [row.dialogue, row.description, row.scene, row.prompt]
      .filter(Boolean)
      .join("\n"),
    characterRows,
  );
  return matched
    .filter(
      (c) => !characterHasResolvedRef(c, assetRefsByKey, catalog),
    )
    .map((c) => c.name);
}

function missingSceneNameInFrame(
  frameScene: string | undefined,
  sceneRows: { key: string; name: string }[],
  sceneAssetRefsByKey?: Record<string, StoryRefImage[]>,
): string | null {
  const s = frameScene?.trim();
  if (!s || !sceneRows.length) return null;
  const hit = sceneRows.find(
    (r) => r.name.trim() === s || s.includes(r.name.trim()),
  );
  if (!hit) return null;
  const refs = sceneAssetRefsByKey?.[hit.key] ?? [];
  if (refs.some(isStoryRefImageResolved)) return null;
  return hit.name;
}

export function buildFrameUpstreamMissingHint(args: {
  missingRefs: StoryRefImage[];
  missingCharacterNames: string[];
  missingSceneName?: string | null;
}): string | null {
  const parts: string[] = [];
  const refLabels = [
    ...new Set(
      args.missingRefs
        .map((r) => r.label?.trim() || r.id.replace(/^ref-[^-]+-/, ""))
        .filter(Boolean),
    ),
  ];
  if (refLabels.length) {
    parts.push(`上游参考未出图：${refLabels.join("、")}`);
  }

  const charsWithoutRefLabel = args.missingCharacterNames.filter(
    (name) => !refLabels.some((l) => l.includes(name)),
  );
  if (charsWithoutRefLabel.length) {
    parts.push(
      `出场角色未出图：${charsWithoutRefLabel.join("、")}（请在人物设计列生成资产）`,
    );
  }

  if (args.missingSceneName) {
    parts.push(
      `场景未出图：${args.missingSceneName}（请在场景设计列生成参考）`,
    );
  }

  return parts.length ? parts.join(" · ") : null;
}

export function assessFrameUpstreamRefs(args: {
  prompt: string;
  catalog: StoryRefImage[];
  row: FrameRowLike;
  characterRows: CharacterRowLike[];
  assetRefsByKey?: Record<string, StoryRefImage[]>;
  sceneRows?: { key: string; name: string }[];
  sceneAssetRefsByKey?: Record<string, StoryRefImage[]>;
}): FrameUpstreamAssessment {
  const fromPrompt = storyRefImagesFromPrompt(args.prompt, args.catalog);
  const { resolved, missing: missingRefs } = partitionStoryRefImages(fromPrompt);
  const missingCharacterNames = missingCharacterNamesInFrame(
    args.row,
    args.characterRows,
    args.assetRefsByKey,
    args.catalog,
  );
  const missingSceneName = missingSceneNameInFrame(
    args.row.scene,
    args.sceneRows ?? [],
    args.sceneAssetRefsByKey,
  );
  const hint = buildFrameUpstreamMissingHint({
    missingRefs,
    missingCharacterNames,
    missingSceneName,
  });
  return { resolved, missingRefs, hint };
}
