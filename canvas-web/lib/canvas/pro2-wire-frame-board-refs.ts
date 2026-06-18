"use client";

import { mergeRefsIntoPrompt } from "./story-pro-frame-ref-suggest";
import { syncFrameRowCharacterRefs } from "./story-column-sync";
import {
  refreshStoryRefImagesFromCatalog,
  storyRefImagesFromPrompt,
  storyRefIdsFromPrompt,
  type StoryRefImage,
} from "./story-ref-image";
import type {
  StoryProCharacterRow,
  StoryProFrameRow,
  StoryProSceneRow,
} from "./story-pro-workspace-types";

function buildSceneRefCatalog(sceneRows: StoryProSceneRow[]): StoryRefImage[] {
  return sceneRows.map((s) => ({
    id: `ref-scene-${s.key}`,
    label: s.name,
    url: s.runtime?.ossUrl ?? s.runtime?.ephemeralUrl,
  }));
}

function buildCharacterRefCatalog(
  characterRows: StoryProCharacterRow[],
): StoryRefImage[] {
  return characterRows.map((c) => ({
    id: `ref-char-${c.key}`,
    label: c.name,
    url: c.runtime?.ossUrl ?? c.runtime?.ephemeralUrl,
  }));
}

function pickSceneForFrame(
  frame: StoryProFrameRow,
  sceneRows: StoryProSceneRow[],
): StoryProSceneRow | undefined {
  const name = frame.scene?.trim() || frame.sceneRefId?.trim();
  if (!name) return undefined;
  return sceneRows.find(
    (s) => s.name.trim() === name || s.key === name || s.key.endsWith(`::${name}`),
  );
}

/** 分镜行 · 关联角色三视图 + 场景图 @ 引用（按镜号 / 场景列） */
export function syncPro2FrameRowUpstreamRefs(
  frame: StoryProFrameRow,
  characterRows: StoryProCharacterRow[],
  sceneRows: StoryProSceneRow[],
): StoryProFrameRow {
  let next = syncFrameRowCharacterRefs(frame, characterRows);
  const scene = pickSceneForFrame(frame, sceneRows);
  if (!scene) return next;

  const sceneRef: StoryRefImage = {
    id: `ref-scene-${scene.key}`,
    label: scene.name,
    url: scene.runtime?.ossUrl ?? scene.runtime?.ephemeralUrl,
  };
  const promptWithScene = mergeRefsIntoPrompt(next.prompt ?? "", [sceneRef]);
  const catalog = [
    ...buildCharacterRefCatalog(characterRows),
    ...buildSceneRefCatalog(sceneRows),
  ];
  const refImages = refreshStoryRefImagesFromCatalog(
    storyRefImagesFromPrompt(promptWithScene, catalog),
    catalog,
  );
  const refImageUrls = refImages
    .map((ref) => ref.url)
    .filter((u): u is string => Boolean(u && /^https?:\/\//.test(u)));

  return {
    ...next,
    prompt: promptWithScene,
    refImages,
    refImageUrls,
    referencedNodeIds: storyRefIdsFromPrompt(promptWithScene),
    sceneRefId: scene.name.trim() || frame.sceneRefId,
  };
}

export function syncPro2FrameRowsUpstreamRefs(
  frameRows: StoryProFrameRow[],
  characterRows: StoryProCharacterRow[],
  sceneRows: StoryProSceneRow[],
): StoryProFrameRow[] {
  return frameRows.map((row) =>
    syncPro2FrameRowUpstreamRefs(row, characterRows, sceneRows),
  );
}
