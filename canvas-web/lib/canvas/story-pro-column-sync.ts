"use client";

import { compactGfmTables, parseMdTable, parseStoryboardRows } from "./parse-md-tables";
import {
  buildCharacterRowsFromHub,
  buildDefaultFrameRowPrompt,
  buildVideoRowsFromFrames,
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

function buildSceneRowsFromStoryboard(
  storyboardMd: string,
  existing?: StoryProSceneRow[],
): StoryProSceneRow[] {
  const frames = parseStoryboardRows(compactGfmTables(storyboardMd));
  const byName = new Map<string, StoryProSceneRow>();
  for (const f of frames) {
    const name = f.scene?.trim() || `场景 ${byName.size + 1}`;
    if (byName.has(name)) continue;
    byName.set(name, {
      key: name,
      name,
      description: f.description?.trim() || "",
      prompt: [`场景：${name}`, f.description?.trim()].filter(Boolean).join("\n"),
    });
  }
  const built = Array.from(byName.values());
  if (!existing?.length) return built;
  return built.map((row) => {
    const prev = existing.find((r) => r.key === row.key || r.name === row.name);
    if (!prev) return row;
    return {
      ...row,
      description: prev.description?.trim() ? prev.description : row.description,
      prompt: prev.prompt?.trim() ? prev.prompt : row.prompt,
      promptHistory: prev.promptHistory,
      refImages: prev.refImages,
      runtime: prev.runtime,
    };
  });
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
      shotSize: shotSize || undefined,
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
  return built.map((row) => {
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
    };
  });
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
    };
  });
}

function mergeProVideoRows(
  built: StoryProVideoRow[],
  existing?: StoryProVideoRow[],
  frameRows?: StoryProFrameRow[],
): StoryProVideoRow[] {
  const merged = patchVideoRowsFromFrameRows(
    existing ?? [],
    (frameRows ?? []) as StoryFrameRow[],
  );
  const prevByKey = new Map((existing ?? []).map((v) => [v.key, v]));
  return built.map((row) => {
    const prev = prevByKey.get(row.key) ?? merged.find((m) => m.key === row.key);
    const frameRow = frameRows?.find(
      (f) => f.key === row.key || f.frameIndex === row.frameIndex,
    );
    const script = frameRow
      ? frameRow.prompt?.trim() || buildDefaultFrameRowPrompt(frameRow)
      : row.videoPrompt;
    return {
      ...row,
      videoPrompt: script,
      videoPromptHistory: prev?.videoPromptHistory,
      videoRuntime: prev?.videoRuntime,
      ttsRuntime: prev?.ttsRuntime,
      ttsPrompt: prev?.ttsPrompt,
      ttsPromptHistory: prev?.ttsPromptHistory,
      refImages: frameRow?.refImages?.length
        ? frameRow.refImages.filter((r) => r.id.startsWith("ref-char-"))
        : row.refImages,
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
  const sceneRows = buildSceneRowsFromStoryboard(
    storyboardMd,
    existing?.sceneRows,
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
