"use client";

import { compactGfmTables, parseMdTable, parseStoryboardRows } from "./parse-md-tables";
import {
  buildCharacterRowsFromHub,
  buildDefaultFrameRowPrompt,
  buildFrameRowScriptPrompt,
  buildDefaultSceneRowPrompt,
  buildSceneRowsFromHub,
  buildVideoRowsFromFrames,
  isFrameScriptPrompt,
  isShotSizeSceneLabel,
  patchVideoRowsFromFrameRows,
  sanitizeLegacyFramePrompt,
  syncFrameRowCharacterRefs,
} from "./story-column-sync";
import { hubDataForColumnSync, resolveHubStoryboardMd } from "./story-hub-runtime";
import type {
  StoryProCharacterRow,
  StoryProFrameRow,
  StoryProSceneRow,
  StoryProScriptHubNodeData,
  StoryProVideoRow,
} from "./story-pro-workspace-types";
import type { StoryCharacterRow, StoryFrameRow } from "./story-workspace-types";
import {
  migrateSceneRowToHubKey,
  sceneRowHubIdFromKey,
  sceneRowKeysEquivalent,
  storyProSceneRowKey,
} from "./story-pro-scene-asset-catalog";

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function pickColumn(
  row: Record<string, string>,
  aliases: string[],
): string {
  for (const [key, val] of Object.entries(row)) {
    const nk = normHeader(key);
    if (aliases.some((a) => nk === a || nk.includes(a))) return val;
  }
  return "";
}

function toProCharacterRows(rows: StoryCharacterRow[]): StoryProCharacterRow[] {
  return rows.map((r) => ({
    key: r.key,
    name: r.name,
    role: r.role,
    appearance: r.appearance,
    prompt: r.prompt,
    promptHistory: r.promptHistory,
    runtime: r.runtime,
  }));
}

function findPrevSceneRow(
  existing: StoryProSceneRow[],
  built: StoryProSceneRow,
  scriptHubId: string,
): StoryProSceneRow | undefined {
  const hub = scriptHubId.trim();
  return existing.find((r) => {
    if (sceneRowKeysEquivalent(r.key, built.key)) return true;
    if (hub) {
      const prevHub = sceneRowHubIdFromKey(r.key);
      if (
        prevHub &&
        prevHub.toLowerCase() !== hub.toLowerCase()
      ) {
        return false;
      }
      if (
        sceneRowKeysEquivalent(migrateSceneRowToHubKey(r, hub), built.key)
      ) {
        return true;
      }
    }
    if (r.name === built.name && !sceneRowHubIdFromKey(r.key)) return true;
    return false;
  });
}

function migrateExistingSceneRows(
  existing: StoryProSceneRow[],
  scriptHubId: string,
): StoryProSceneRow[] {
  const hub = scriptHubId.trim();
  if (!hub) return existing;
  return existing.map((r) => ({
    ...r,
    key: migrateSceneRowToHubKey(r, hub),
  }));
}

/** 无场景辞典时：仅当分镜表「场景」列为真实场景名（非景别）才回落 */
function buildSceneRowsFromStoryboardFallback(
  storyboardMd: string,
  scriptHubId: string,
): StoryProSceneRow[] {
  const frames = parseStoryboardRows(compactGfmTables(storyboardMd));
  const byName = new Map<string, StoryProSceneRow>();
  for (const f of frames) {
    const name = f.scene?.trim();
    if (!name || isShotSizeSceneLabel(name)) continue;
    if (byName.has(name)) continue;
    byName.set(name, {
      key: storyProSceneRowKey(scriptHubId, name),
      name,
      description: f.description?.trim() || "",
      prompt: buildDefaultSceneRowPrompt({
        name,
        environment: "",
        time: "",
        mood: "",
        imageKeywords: "",
        description: f.description?.trim() || "",
      }),
    });
  }
  return Array.from(byName.values());
}

function isStaleSceneRow(row: StoryProSceneRow): boolean {
  const name = row.name.trim();
  if (!name) return true;
  if (isFrameScriptPrompt(row.prompt ?? "")) return true;
  if (/^镜\s*\d+$/.test(name)) return true;
  if (/^场景\s*\d+$/.test(name)) return true;
  if (isShotSizeSceneLabel(name)) return true;
  return false;
}

function sceneRowDetailScore(row: StoryProSceneRow): number {
  let score = 0;
  if (row.description?.trim()) score += 1;
  if (row.prompt?.trim()) score += 2;
  if (row.runtime) score += 1;
  return score;
}

/** 场景行按 name / hubKey 去重（公告栏与剧本包导入共用） */
export function dedupeProSceneRows(
  rows: StoryProSceneRow[],
  scriptHubId = "",
): StoryProSceneRow[] {
  const hub = scriptHubId.trim();
  const out: StoryProSceneRow[] = [];
  for (const row of rows) {
    if (isStaleSceneRow(row)) continue;
    const migrated: StoryProSceneRow = hub
      ? { ...row, key: migrateSceneRowToHubKey(row, hub) }
      : row;
    const prev = findPrevSceneRow(out, migrated, hub);
    if (prev) {
      const idx = out.indexOf(prev);
      const richer =
        sceneRowDetailScore(migrated) >= sceneRowDetailScore(prev)
          ? { ...migrated, key: prev.key }
          : { ...prev, ...migrated, key: prev.key };
      out[idx] = richer;
    } else {
      out.push(migrated);
    }
  }
  return out;
}

function mergeProSceneRows(
  built: StoryProSceneRow[],
  existing?: StoryProSceneRow[],
  scriptHubId = "",
  fromDictionary = false,
): StoryProSceneRow[] {
  const prior = existing?.length
    ? migrateExistingSceneRows(existing, scriptHubId).filter(
        (r) => !isStaleSceneRow(r),
      )
    : [];
  if (!prior.length) return built;
  if (!built.length) return prior;
  const merged = built.map((row) => {
    const prev = findPrevSceneRow(prior, row, scriptHubId);
    if (!prev) return row;
    return {
      ...row,
      description: prev.description?.trim() ? prev.description : row.description,
      prompt:
        prev.prompt?.trim() && !isFrameScriptPrompt(prev.prompt)
          ? prev.prompt
          : row.prompt,
      promptHistory: prev.promptHistory,
      refImages: prev.refImages,
      runtime: prev.runtime,
    };
  });
  if (fromDictionary) return merged;
  const mergedNames = new Set(merged.map((r) => r.name));
  const mergedKeys = new Set(merged.map((r) => r.key));
  const extras = prior.filter(
    (r) =>
      !mergedNames.has(r.name) &&
      !mergedKeys.has(r.key) &&
      !isStaleSceneRow(r),
  );
  return extras.length ? [...merged, ...extras] : merged;
}

function buildProFrameRowsFromMd(
  md: string,
  characterRows: StoryProCharacterRow[],
): StoryProFrameRow[] {
  const charCompat: StoryCharacterRow[] = characterRows;
  const { rows } = parseMdTable(compactGfmTables(md));
  const basic = parseStoryboardRows(md);
  return basic.map((b, i) => {
    const r = rows[i] ?? {};
    const shotNo =
      pickColumn(r, ["镜号", "shot", "index", "frame"]) || String(b.frameIndex);
    const shotSize = pickColumn(r, ["景别", "shot size", "framing"]);
    const cameraMove = pickColumn(r, ["运镜", "camera", "camera move"]);
    const durationRaw = pickColumn(r, ["时长", "duration", "时长(秒)"]);
    const difficultyRaw = pickColumn(r, ["ai难度", "难度", "ai difficulty"]);
    const durationSec = durationRaw ? parseInt(durationRaw, 10) : undefined;
    const aiDifficulty = difficultyRaw ? parseInt(difficultyRaw, 10) : undefined;
    const base: StoryFrameRow = syncFrameRowCharacterRefs(
      {
        frameIndex: b.frameIndex,
        key: String(b.frameIndex),
        scene: b.scene,
        shotSize: b.shotSize || shotSize || undefined,
        description: b.description,
        dialogue: b.dialogue,
        videoPrompt: b.videoPrompt,
        prompt: "",
      },
      charCompat,
    );
    return {
      ...base,
      shotNo,
      shotSize: shotSize || base.shotSize || undefined,
      cameraMove: cameraMove || undefined,
      durationSec: Number.isFinite(durationSec) ? durationSec : undefined,
      aiDifficulty: Number.isFinite(aiDifficulty) ? aiDifficulty : undefined,
      sceneRefId: b.scene?.trim() || undefined,
    };
  });
}

function mergeProFrameRows(
  built: StoryProFrameRow[],
  existing?: StoryProFrameRow[],
): StoryProFrameRow[] {
  if (!existing?.length) return built;
  const merged = built.map((row) => {
    const prev = existing.find(
      (r) => r.key === row.key || r.frameIndex === row.frameIndex,
    );
    if (!prev) return row;
    return {
      ...row,
      prompt: prev.prompt?.trim()
        ? sanitizeLegacyFramePrompt(prev.prompt) ||
          buildDefaultFrameRowPrompt(row)
        : row.prompt,
      promptHistory: prev.promptHistory,
      runtime: prev.runtime,
      refImages: prev.refImages,
      refImageUrls: prev.refImageUrls,
      referencedNodeIds: prev.referencedNodeIds,
      frameApprovedAt: prev.frameApprovedAt,
      frameRejectedReason: prev.frameRejectedReason,
    };
  });
  const mergedKeys = new Set(merged.map((r) => r.key));
  const mergedIndexes = new Set(merged.map((r) => r.frameIndex));
  const extras = existing.filter(
    (r) => !mergedKeys.has(r.key) && !mergedIndexes.has(r.frameIndex),
  );
  return extras.length ? [...merged, ...extras] : merged;
}

function mergeProCharacterRows(
  built: StoryProCharacterRow[],
  existing?: StoryProCharacterRow[],
): StoryProCharacterRow[] {
  if (!existing?.length) return built;
  return built.map((row) => {
    const prev = existing.find(
      (r) => r.key === row.key || r.name === row.name,
    );
    if (!prev) return row;
    return {
      ...row,
      prompt: prev.prompt?.trim() ? prev.prompt : row.prompt,
      promptHistory: prev.promptHistory,
      runtime: prev.runtime,
      assetId: prev.assetId,
      lockedRefIds: prev.lockedRefIds,
    };
  });
}

function mergeProVideoRows(
  built: StoryProVideoRow[],
  existing?: StoryProVideoRow[],
  frameRows?: StoryProFrameRow[],
): StoryProVideoRow[] {
  const frames = (frameRows ?? []) as StoryFrameRow[];
  const aligned = patchVideoRowsFromFrameRows(
    existing ?? [],
    frames.length > 0 ? frames : (built as StoryFrameRow[]),
  );
  const prevByKey = new Map((existing ?? []).map((v) => [v.key, v]));
  return aligned.map((row) => {
    const prev = prevByKey.get(row.key);
    const frameRow = frames.find(
      (f) => f.key === row.key || f.frameIndex === row.frameIndex,
    );
    const script = frameRow
      ? frameRow.prompt?.trim() ||
        buildFrameRowScriptPrompt(frameRow) ||
        buildDefaultFrameRowPrompt(frameRow)
      : row.videoPrompt;
    return {
      ...row,
      videoPrompt: script,
      videoPromptHistory: prev?.videoPromptHistory,
      videoRuntime: prev?.videoRuntime,
      ttsRuntime: prev?.ttsRuntime,
      ttsPrompt: prev?.ttsPrompt,
      ttsPromptHistory: prev?.ttsPromptHistory,
      refImages: frameRow?.refImages?.length ? frameRow.refImages : row.refImages,
      videoReferencedNodeIds:
        frameRow?.referencedNodeIds ?? row.videoReferencedNodeIds,
    };
  });
}

export type StoryProColumnSyncExisting = Partial<{
  characterRows: StoryProCharacterRow[];
  sceneRows: StoryProSceneRow[];
  frameRows: StoryProFrameRow[];
  videoRows: StoryProVideoRow[];
}>;

/** 从 script hub 文案拆分角色 / 场景 / 分镜 / 视频行（不触发媒体 run） */
export function syncStoryProColumnRows(
  hubData: StoryProScriptHubNodeData,
  existing?: StoryProColumnSyncExisting,
  scriptHubId?: string,
): {
  characterRows: StoryProCharacterRow[];
  sceneRows: StoryProSceneRow[];
  frameRows: StoryProFrameRow[];
  videoRows: StoryProVideoRow[];
} {
  const synced = hubDataForColumnSync(
    hubData as Parameters<typeof hubDataForColumnSync>[0],
  ) as StoryProScriptHubNodeData;
  const characterRows = mergeProCharacterRows(
    toProCharacterRows(buildCharacterRowsFromHub(synced)),
    existing?.characterRows,
  );
  const storyboardMd = resolveHubStoryboardMd(
    synced as Parameters<typeof resolveHubStoryboardMd>[0],
  );
  const hubId = scriptHubId?.trim() ?? "";
  const fromDictionary = buildSceneRowsFromHub(synced, hubId);
  const sceneBuilt =
    fromDictionary.length > 0
      ? fromDictionary
      : buildSceneRowsFromStoryboardFallback(storyboardMd, hubId);
  const sceneRows = mergeProSceneRows(
    sceneBuilt,
    existing?.sceneRows,
    hubId,
    fromDictionary.length > 0,
  );
  const frameRows = mergeProFrameRows(
    buildProFrameRowsFromMd(storyboardMd, characterRows),
    existing?.frameRows,
  );
  const videoRows = mergeProVideoRows(
    buildVideoRowsFromFrames(frameRows as StoryFrameRow[]) as StoryProVideoRow[],
    existing?.videoRows,
    frameRows,
  );
  return { characterRows, sceneRows, frameRows, videoRows };
}
