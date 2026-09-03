"use client";

import { mergeRefsIntoPrompt } from "./story-pro-frame-ref-suggest";
import { syncFrameRowCharacterRefs } from "./story-column-sync";
import { hydrateCanvasFramePromptMentions } from "./pro2-frame-shot-ref-prep";
import {
  refreshStoryRefImagesFromCatalog,
  storyRefIdsFromPrompt,
  type StoryRefImage,
} from "./story-ref-image";
import type {
  StoryProCharacterRow,
  StoryProFrameRow,
  StoryProPropRow,
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

export function buildFrameBoardRefCatalog(
  characterRows: StoryProCharacterRow[],
  sceneRows: StoryProSceneRow[],
  propRows: StoryProPropRow[] = [],
): StoryRefImage[] {
  return [
    ...buildCharacterRefCatalog(characterRows),
    ...buildSceneRefCatalog(sceneRows),
    ...buildPropRefCatalog(propRows),
  ];
}

function buildPropRefCatalog(propRows: StoryProPropRow[]): StoryRefImage[] {
  return propRows.map((p) => ({
    id: `ref-prop-${p.key}`,
    label: p.name,
    url: p.runtime?.ossUrl ?? p.runtime?.ephemeralUrl,
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

function linkedPropRefs(
  frame: StoryProFrameRow,
  propRows: StoryProPropRow[],
): StoryRefImage[] {
  const ids = new Set(frame.propRefIds ?? []);
  if (!ids.size) return [];
  return propRows
    .filter((p) => ids.has(p.key))
    .map((p) => ({
      id: `ref-prop-${p.key}`,
      label: p.name,
      url: p.runtime?.ossUrl ?? p.runtime?.ephemeralUrl,
    }));
}

function linkedCharacterRefs(
  frame: StoryProFrameRow,
  characterRows: StoryProCharacterRow[],
): StoryRefImage[] {
  const keys = new Set<string>();
  for (const id of frame.characterRefIds ?? []) keys.add(id);
  for (const id of frame.referencedNodeIds ?? []) {
    if (id.startsWith("ref-char-")) keys.add(id.slice("ref-char-".length));
  }
  if (!keys.size) return [];
  return characterRows
    .filter((c) => keys.has(c.key))
    .map((c) => ({
      id: `ref-char-${c.key}`,
      label: c.name,
      url: c.runtime?.ossUrl ?? c.runtime?.ephemeralUrl,
    }));
}

/** 分镜行 · 关联角色三视图 + 场景图 + 道具图 @ 引用（按镜号 / 元数据） */
export function syncPro2FrameRowUpstreamRefs(
  frame: StoryProFrameRow,
  characterRows: StoryProCharacterRow[],
  sceneRows: StoryProSceneRow[],
  propRows: StoryProPropRow[] = [],
): StoryProFrameRow {
  let next = syncFrameRowCharacterRefs(frame, characterRows);

  const catalog = [
    ...buildCharacterRefCatalog(characterRows),
    ...buildSceneRefCatalog(sceneRows),
    ...buildPropRefCatalog(propRows),
  ];

  const hydrateEntities = catalog.map((c) => ({
    id: c.id,
    name: c.label,
  }));

  let prompt = hydrateCanvasFramePromptMentions(
    next.prompt ?? frame.frameImagePrompt ?? "",
    hydrateEntities,
  );

  const explicitRefs: StoryRefImage[] = [
    ...linkedCharacterRefs(frame, characterRows),
    ...linkedPropRefs(frame, propRows),
  ];
  const scene = pickSceneForFrame(frame, sceneRows);
  if (scene) {
    explicitRefs.push({
      id: `ref-scene-${scene.key}`,
      label: scene.name,
      url: scene.runtime?.ossUrl ?? scene.runtime?.ephemeralUrl,
    });
  }

  const withUrls = explicitRefs.filter(
    (r) => r.url && /^https?:\/\//.test(String(r.url)),
  );
  prompt = mergeRefsIntoPrompt(prompt, withUrls);

  const mentionedIds = storyRefIdsFromPrompt(prompt);
  const refImages = refreshStoryRefImagesFromCatalog(
    mentionedIds.length
      ? mentionedIds.map((id) => {
          const fromCatalog = catalog.find((c) => c.id === id);
          if (fromCatalog) return { ...fromCatalog };
          const fromExplicit = explicitRefs.find((r) => r.id === id);
          return (
            fromExplicit ?? {
              id,
              label: id.replace(/^ref-(char|scene|prop)-/, ""),
            }
          );
        })
      : withUrls,
    catalog,
  );
  const refImageUrls = refImages
    .map((ref) => ref.url)
    .filter((u): u is string => Boolean(u && /^https?:\/\//.test(u)));

  return {
    ...next,
    characterRefIds: frame.characterRefIds ?? next.characterRefIds,
    propRefIds: frame.propRefIds,
    prompt,
    frameImagePrompt: frame.frameImagePrompt ?? prompt,
    refImages,
    refImageUrls,
    referencedNodeIds: storyRefIdsFromPrompt(prompt),
    sceneRefId: scene?.name.trim() || frame.sceneRefId,
  };
}

export function syncPro2FrameRowsUpstreamRefs(
  frameRows: StoryProFrameRow[],
  characterRows: StoryProCharacterRow[],
  sceneRows: StoryProSceneRow[],
  propRows: StoryProPropRow[] = [],
): StoryProFrameRow[] {
  return frameRows.map((row) =>
    syncPro2FrameRowUpstreamRefs(row, characterRows, sceneRows, propRows),
  );
}
