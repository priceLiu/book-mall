"use client";

import {
  buildPro2ThreeViewDockPrompt,
  shouldRebuildPro2CharacterRowPrompt,
} from "./three-view-prompt-rules";
import {
  parseVisualStylePackFromOutline,
  type StoryProVisualStylePack,
} from "./story-pro-visual-style-pack";
import { hubDataForColumnSync, resolveHubStoryboardMd } from "./story-hub-runtime";
import {
  outlineCharacterNamesAlign,
  parseCharacterRows,
  parseCharacterListFromSection,
  parseOutlineBriefCharacters,
  parseStoryboardRows,
  parseSceneVisualDictionaryRows,
  resolveMergedSceneVisualDictionaryRows,
  resolveSceneDictionaryMarkdown,
  extractCharacterSectionFromOutline,
  type SceneVisualDictionaryRow,
} from "./parse-md-tables";
import {
  refreshStoryRefImagesFromCatalog,
  storyRefIdsFromPrompt,
  storyRefImagesFromPrompt,
  type StoryRefImage,
} from "./story-ref-image";
import { storyProSceneRowKey } from "./story-pro-scene-asset-catalog";
import {
  isAnyStoryScriptHubType,
} from "./story-workspace-resolver";
import { finalizeStoryPro2SceneImagePrompt } from "./story-pro2-scene-image-prompt";
import type { StoryProSceneRow } from "./story-pro-workspace-types";
import type {
  StoryCharacterRow,
  StoryFrameRow,
  StoryScriptHubNodeData,
  StoryVideoRow,
} from "./story-workspace-types";
import type { CanvasFlowNode } from "./types";

function hubVisualStylePackForCharacterRows(
  d: StoryScriptHubNodeData,
): StoryProVisualStylePack | null {
  const ext = d as {
    visualStylePack?: StoryProVisualStylePack;
    outlineMd?: string;
  };
  return (
    ext.visualStylePack ??
    (ext.outlineMd?.trim()
      ? parseVisualStylePackFromOutline(ext.outlineMd)
      : null)
  );
}

function characterRowFromParts(
  c: {
    name: string;
    role: string;
    appearance: string;
    personality?: string;
    aiImagePrompt?: string;
  },
  promptOverride?: string,
  visualStylePack?: StoryProVisualStylePack | null,
): StoryCharacterRow {
  const aiImagePrompt = c.aiImagePrompt?.trim() || undefined;
  return {
    key: c.name,
    name: c.name,
    role: c.role,
    appearance: c.appearance,
    personality: c.personality?.trim() || undefined,
    aiImagePrompt,
    prompt: promptOverride?.trim() || "",
  };
}

export function buildCharacterRowsFromMd(md: string): StoryCharacterRow[] {
  return parseCharacterRows(md).map((c) => characterRowFromParts(c));
}

/** 以定稿大纲中的角色设定为准；无角色则返回空行（仍创建角色列节点） */
export function buildCharacterRowsFromHub(
  d: StoryScriptHubNodeData,
): StoryCharacterRow[] {
  const synced = hubDataForColumnSync(d);
  const characterSource =
    (synced.characterMd ?? "").trim() ||
    extractCharacterSectionFromOutline(d.outlineMd ?? "");
  const visualPack = hubVisualStylePackForCharacterRows(d);
  const fromCharacter = parseCharacterListFromSection(characterSource);
  if (fromCharacter.length > 0) {
    return fromCharacter.map((c) => characterRowFromParts(c, undefined, visualPack));
  }
  const fromBrief = parseOutlineBriefCharacters(d.outlineMd ?? "");
  if (fromBrief.length > 0) {
    return fromBrief.map((b) =>
      characterRowFromParts(
        {
          name: b.name,
          role: b.role || "",
          appearance: b.appearance,
        },
        undefined,
        visualPack,
      ),
    );
  }
  return [];
}

export function hubCharacterCastOutOfSync(d: StoryScriptHubNodeData): boolean {
  const brief = parseOutlineBriefCharacters(d.outlineMd ?? "");
  if (brief.length) {
    return !outlineCharacterNamesAlign(d.outlineMd ?? "", d.characterMd ?? "");
  }
  return !(d.characterMd ?? "").trim() && Boolean((d.outlineMd ?? "").trim());
}

/** 分镜脚本（场景/画面/对白）文本中出现过的角色 */
export function charactersInFrameScript<T extends { key: string; name: string }>(
  frame: { scene: string; description: string; dialogue: string },
  characterRows: T[],
): T[] {
  const blob = `${frame.scene} ${frame.description} ${frame.dialogue}`;
  return characterRows.filter((c) => c.name.trim() && blob.includes(c.name));
}

function buildFrameRefImagesForCharacters(
  characters: StoryCharacterRow[],
): StoryRefImage[] {
  return characters.map((c) => ({
    id: `ref-char-${c.key}`,
    label: c.name,
    url: c.runtime?.ossUrl ?? c.runtime?.ephemeralUrl,
  }));
}

/** 分镜列「镜 1」栏展示的 @ 引用说明（不写入每镜 prompt 正文） */
export const FRAME_ROW_AT_HINT =
  "（@ 仅列出已出图的角色/场景资产；未出图项在下方提示，不进入参考列）";

/** 图 2 · 锁定 / 前置条件 / @ 说明等提示文案（金黄） */
export const STORY_HINT_GOLD_CLASS = "text-amber-300/90";
export const STORY_HINT_GOLD_BORDER_CLASS = "border-amber-400/55";
/** @deprecated 保留别名，新代码请用 STORY_HINT_GOLD_CLASS */
export const STORY_HINT_BLUE_CLASS = STORY_HINT_GOLD_CLASS;
/** 模型选择 / 分镜图·视频 等区块标签：金黄 + 左侧竖线 */
export const STORY_HINT_LABEL_CLASS = `border-l-2 ${STORY_HINT_GOLD_BORDER_CLASS} pl-2 text-[10px] uppercase tracking-wider ${STORY_HINT_GOLD_CLASS}`;
/** 行内说明、@ 引用提示等正文级提示 */
export const STORY_HINT_BODY_CLASS = `text-[10px] leading-relaxed ${STORY_HINT_GOLD_CLASS}`;
/** 菜单 / 节点头 / 状态类文案（绿色） */
export const STORY_CHROME_GREEN_CLASS = "text-emerald-300/90";
/** 资产槽 / 分镜行辅助说明（提示语，金黄） */
export const STORY_ROW_META_CLASS = STORY_HINT_BODY_CLASS;
/** 节点内区块标题 / 状态说明（绿色） */
export const STORY_ROW_SECTION_CLASS = `text-[10px] leading-relaxed ${STORY_CHROME_GREEN_CLASS}`;
/** 资产槽内次级标签（槽位名等） */
export const STORY_ROW_SUBLABEL_CLASS =
  "text-[9px] text-emerald-200/75";
/** 错误信息：单行省略，hover title 展示全文 */
export const STORY_ERROR_LINE_CLASS =
  "truncate text-[10px] leading-snug text-red-400/90";
/** 行内轻量操作按钮 */
export const STORY_ROW_ACTION_BTN_CLASS =
  "nodrag rounded border border-white/15 px-2 py-0.5 text-[10px] text-white/75 hover:bg-white/5 disabled:opacity-40";
/** 行内提示条（入库、建议 @ 等） */
export const STORY_ROW_BANNER_CLASS =
  "flex flex-wrap items-center gap-2 rounded border border-white/10 bg-black/25 px-2 py-1.5";

/** 从已保存 prompt 中去掉 @ 说明行（历史数据可能写在每镜末尾） */
export function stripFrameRowAtHint(prompt: string): string {
  return prompt
    .replace(/\n?（输入 @ 可引用已生成的角色三视图）\s*/g, "")
    .trim();
}

/** 移除旧版分镜图说明（历史项目 prompt 中可能残留） */
export function sanitizeLegacyFramePrompt(prompt: string): string {
  let p = stripFrameRowAtHint(prompt);
  p = p.replace(
    /根据分镜「画面描述」生成单镜静态图[。.]?\s*若已连接角色三视图参考图[，,]?\s*必须保持角色脸型[、,]\s*发型[、,]\s*服饰与参考一致[。.]?\s*/g,
    "",
  );
  p = p.replace(/^根据分镜「画面描述」生成单镜静态图[^\n]*\n*/m, "");
  p = p.replace(/^若已连接角色三视图参考图[^\n]*\n*/m, "");
  return p.trim();
}

function dialogueLine(dialogue?: string): string {
  const d = dialogue?.trim();
  if (!d || d === "—" || d === "-") return "";
  return `对白：${d}`;
}

/** 分镜静帧生图 · 不含英文视频运镜（避免 prompt 超 5000 字） */
export function buildFrameRowImagePrompt(frame: {
  frameIndex: number;
  scene: string;
  shotSize?: string;
  description: string;
  dialogue?: string;
}): string {
  const parts = [
    `镜 ${frame.frameIndex}`,
    frame.shotSize?.trim() ? `景别：${frame.shotSize.trim()}` : "",
    frame.scene?.trim() ? `场景：${frame.scene.trim()}` : "",
    frame.description?.trim() ? `镜头描述：${frame.description.trim()}` : "",
    dialogueLine(frame.dialogue),
  ].filter(Boolean);
  return parts.join("\n");
}

/** 分镜脚本列 / 视频生成共用：镜号 + 景别 + 场景 + 镜头描述 + 对白 + 运镜 */
export function buildFrameRowScriptPrompt(frame: {
  frameIndex: number;
  scene: string;
  shotSize?: string;
  description: string;
  dialogue?: string;
  videoPrompt?: string;
}): string {
  const parts = [
    `镜 ${frame.frameIndex}`,
    frame.shotSize?.trim() ? `景别：${frame.shotSize.trim()}` : "",
    frame.scene?.trim() ? `场景：${frame.scene.trim()}` : "",
    frame.description?.trim() ? `镜头描述：${frame.description.trim()}` : "",
    dialogueLine(frame.dialogue),
  ].filter(Boolean);
  const motion = frame.videoPrompt?.trim();
  if (motion && motion !== "—" && motion !== "-") {
    parts.push(`运镜：${motion}`);
  }
  return parts.join("\n");
}

function resolveFrameRowPrompt(frame: StoryFrameRow): string {
  const cleaned = frame.prompt?.trim()
    ? sanitizeLegacyFramePrompt(frame.prompt)
    : "";
  return cleaned || buildDefaultFrameRowPrompt(frame);
}

export function buildDefaultFrameRowPrompt(frame: {
  frameIndex: number;
  scene: string;
  shotSize?: string;
  description: string;
  dialogue?: string;
  videoPrompt?: string;
  aiImagePrompt?: string;
}): string {
  const fromPack = frame.aiImagePrompt?.trim();
  if (fromPack) return fromPack;
  return buildFrameRowImagePrompt(frame);
}

const SHOT_SIZE_SCENE_LABELS = new Set([
  "远景",
  "全景",
  "中景",
  "近景",
  "特写",
  "大特写",
  "大全景",
  "中近景",
  "过肩",
]);

export function isShotSizeSceneLabel(name: string): boolean {
  const t = name.trim();
  if (!t) return true;
  if (SHOT_SIZE_SCENE_LABELS.has(t)) return true;
  return /^(远景|全景|中景|近景|特写)/.test(t);
}

/** 场景设计列：环境参考图 prompt（非分镜脚本） */
export function buildDefaultSceneRowPrompt(
  row: SceneVisualDictionaryRow & { description?: string },
): string {
  const envTimeMood =
    row.envTimeMood?.trim() ||
    [row.environment, row.time, row.mood].filter(Boolean).join(" · ");
  const parts = [
    row.name.trim() ? `场景：${row.name.trim()}` : "",
    envTimeMood ? `环境/时间/气氛：${envTimeMood}` : "",
    row.imageKeywords?.trim() ? `生图：${row.imageKeywords.trim()}` : "",
    !envTimeMood &&
    !row.imageKeywords?.trim() &&
    row.description?.trim()
      ? `画面：${row.description.trim()}`
      : "",
  ].filter(Boolean);
  let prompt = finalizeStoryPro2SceneImagePrompt(parts.join("\n"));
  const neg = row.negativePrompt?.trim();
  if (neg) prompt = `${prompt}\n【反向提示词】${neg}`;
  return prompt;
}

/** 场景设计列 / 场景图节点 Dock · 结构化展示 + 生图关键词 */
export function formatSceneRowDockInput(row: StoryProSceneRow): string {
  const envTimeMood =
    [row.environment, row.time, row.mood].filter(Boolean).join(" · ") ||
    row.description?.trim() ||
    "";
  const parts = [
    row.name.trim() ? `场景：${row.name.trim()}` : "",
    envTimeMood ? `环境/时间/气氛：${envTimeMood}` : "",
    (row.imageKeywords ?? "").trim()
      ? `生图：${row.imageKeywords!.trim()}`
      : "",
    !row.imageKeywords?.trim() && row.description?.trim() && !envTimeMood
      ? `画面：${row.description.trim()}`
      : "",
  ].filter(Boolean);
  let prompt = finalizeStoryPro2SceneImagePrompt(parts.join("\n"));
  const neg = row.negativePrompt?.trim();
  if (neg) prompt = `${prompt}\n【反向提示词】${neg}`;
  return prompt;
}

/** 分镜脚本格式误入场景列时识别并覆盖 */
export function isFrameScriptPrompt(prompt: string): boolean {
  const p = prompt.trim();
  if (!p) return false;
  if (/^镜\s*\d/m.test(p)) return true;
  return (
    p.includes("镜头描述：") ||
    p.includes("运镜：") ||
    p.includes("对白：")
  );
}

/** 从故事剧本大纲「场景视觉辞典」拆分场景行（定稿真源） */
export function buildSceneRowsFromHub(
  d: StoryScriptHubNodeData,
  scriptHubId: string,
): StoryProSceneRow[] {
  const synced = hubDataForColumnSync(d);
  const dictRows = resolveMergedSceneVisualDictionaryRows(
    synced.outlineMd ?? "",
    synced.sceneMd ?? "",
  );
  const hub = scriptHubId.trim();
  const byKey = new Map<string, StoryProSceneRow>();
  for (const r of dictRows) {
    const key = hub ? storyProSceneRowKey(hub, r.name) : r.name;
    if (byKey.has(key)) continue;
    const row: StoryProSceneRow = {
      key,
      name: r.name,
      environment: r.environment?.trim() || undefined,
      time: r.time?.trim() || undefined,
      mood: r.mood?.trim() || undefined,
      imageKeywords: r.imageKeywords?.trim() || undefined,
      negativePrompt: r.negativePrompt?.trim() || undefined,
      description:
        r.envTimeMood?.trim() ||
        [r.environment, r.time, r.mood].filter(Boolean).join(" · "),
      prompt: "",
    };
    byKey.set(key, row);
  }
  return Array.from(byKey.values());
}

/**
 * 同步分镜行参考图 URL；不修改用户提示词里的 @。
 * 参考图列仅展示提示词中已 @ 的角色；@ 菜单由角色列已出图列表提供。
 */
export function syncFrameRowCharacterRefs(
  frame: StoryFrameRow,
  characterRows: StoryCharacterRow[],
): StoryFrameRow {
  const catalog = buildFrameRefImagesForCharacters(characterRows);
  const prompt = resolveFrameRowPrompt(frame);
  const refImages = refreshStoryRefImagesFromCatalog(
    storyRefImagesFromPrompt(prompt, catalog),
    catalog,
  );
  const referencedNodeIds = storyRefIdsFromPrompt(prompt);
  const refImageUrls = refImages
    .map((ref) => ref.url)
    .filter((u): u is string => Boolean(u && /^https?:\/\//.test(u)));
  return {
    ...frame,
    prompt,
    refImages,
    refImageUrls,
    referencedNodeIds,
  };
}

export function buildFrameRowsFromMd(
  md: string,
  characterRows: StoryCharacterRow[],
): StoryFrameRow[] {
  return parseStoryboardRows(md).map((r) => {
    const aiImagePrompt = r.aiImagePrompt?.trim() || undefined;
    return syncFrameRowCharacterRefs(
      {
        frameIndex: r.frameIndex,
        key: String(r.frameIndex),
        scene: r.scene,
        shotSize: r.shotSize,
        description: r.description,
        dialogue: r.dialogue,
        videoPrompt: r.videoPrompt,
        prompt: aiImagePrompt ?? "",
      },
      characterRows,
    );
  });
}

export function buildVideoRowsFromFrames(
  frameRows: StoryFrameRow[],
): StoryVideoRow[] {
  return frameRows.map((f) => {
    const script =
      f.prompt?.trim() || buildFrameRowScriptPrompt(f);
    /** 含 ref-asset / ref-char / ref-scene-asset，供视频 run 解析 @ */
    const refImages = f.refImages ?? [];
    return {
      frameIndex: f.frameIndex,
      key: String(f.frameIndex),
      dialogue: f.dialogue,
      videoPrompt: script,
      refImages,
      videoReferencedNodeIds: f.referencedNodeIds ?? [],
      frameImageUrl:
        f.runtime?.ossUrl ?? f.runtime?.ephemeralUrl ?? undefined,
      frameApprovedAt: f.frameApprovedAt,
    };
  });
}

/** 分镜列保存 / 生成前：把脚本与 @ 参考同步到视频列同行（含从分镜行重建缺失行） */
export function patchVideoRowsFromFrameRows(
  videoRows: StoryVideoRow[],
  frameRows: StoryFrameRow[],
): StoryVideoRow[] {
  const prevByKey = new Map(videoRows.map((v) => [v.key, v]));
  return buildVideoRowsFromFrames(frameRows).map((built) => {
    const prev = prevByKey.get(built.key);
    if (!prev) return built;
    return {
      ...built,
      videoPromptHistory: prev.videoPromptHistory,
      ttsPrompt: prev.ttsPrompt,
      ttsPromptHistory: prev.ttsPromptHistory,
      videoRuntime: prev.videoRuntime,
      ttsRuntime: prev.ttsRuntime,
    };
  });
}

export function syncColumnsFromHub(
  nodes: CanvasFlowNode[],
  hubId: string,
  characterColumnId: string,
  frameColumnId: string,
  videoColumnId: string,
): {
  characterPatch: { rows: StoryCharacterRow[]; hubNodeId: string };
  framePatch: { rows: StoryFrameRow[]; hubNodeId: string };
  videoPatch: {
    rows: StoryVideoRow[];
    hubNodeId: string;
    frameColumnId: string;
  };
} | null {
  const hub = nodes.find((n) => n.id === hubId);
  if (!hub || !isAnyStoryScriptHubType(hub.type ?? "")) return null;
  const d = hubDataForColumnSync(hub.data as unknown as StoryScriptHubNodeData);
  const charRows = buildCharacterRowsFromHub(d);
  const existingChar = (
    nodes.find((n) => n.id === characterColumnId)?.data as {
      rows?: StoryCharacterRow[];
    }
  )?.rows;
  const mergedChar = charRows.map((row) => {
    const prev = existingChar?.find(
      (r) => r.key === row.key || r.name === row.name,
    );
    if (!prev) return row;
    return {
      ...row,
      prompt: shouldRebuildPro2CharacterRowPrompt(prev, row)
        ? ""
        : prev.prompt?.trim() || "",
      promptHistory: prev.promptHistory,
      runtime: prev.runtime,
    };
  });
  const frameRows = buildFrameRowsFromMd(resolveHubStoryboardMd(d), mergedChar);
  const existingFrame = (
    nodes.find((n) => n.id === frameColumnId)?.data as {
      rows?: StoryFrameRow[];
    }
  )?.rows;
  const mergedFrame = frameRows.map((row) => {
    const prev = existingFrame?.find(
      (r) => r.key === row.key || r.frameIndex === row.frameIndex,
    );
    const base: StoryFrameRow = prev
      ? {
          ...row,
          prompt: prev.prompt?.trim()
            ? sanitizeLegacyFramePrompt(prev.prompt) ||
              buildDefaultFrameRowPrompt(row)
            : row.prompt,
          promptHistory: prev.promptHistory,
          runtime: prev.runtime,
          frameApprovedAt: prev.frameApprovedAt,
          frameRejectedReason: prev.frameRejectedReason,
        }
      : row;
    return syncFrameRowCharacterRefs(base, mergedChar);
  });
  const videoRows = buildVideoRowsFromFrames(mergedFrame);
  const existingVideo = (
    nodes.find((n) => n.id === videoColumnId)?.data as {
      rows?: StoryVideoRow[];
    }
  )?.rows;
  const mergedVideo = videoRows.map((row) => {
    const prev = existingVideo?.find(
      (r) => r.key === row.key || r.frameIndex === row.frameIndex,
    );
    const frameRow = mergedFrame.find(
      (f) => f.key === row.key || f.frameIndex === row.frameIndex,
    );
    const script = frameRow
      ? frameRow.prompt?.trim() || buildFrameRowScriptPrompt(frameRow)
      : row.videoPrompt;
    return {
      ...row,
      videoPrompt: script,
      videoPromptHistory: prev?.videoPromptHistory,
      videoRuntime: prev?.videoRuntime,
      ttsRuntime: prev?.ttsRuntime,
      refImages: frameRow?.refImages?.length ? frameRow.refImages : row.refImages,
      videoReferencedNodeIds:
        frameRow?.referencedNodeIds ?? row.videoReferencedNodeIds,
    };
  });
  return {
    characterPatch: { rows: mergedChar, hubNodeId: hubId },
    framePatch: { rows: mergedFrame, hubNodeId: hubId },
    videoPatch: {
      rows: mergedVideo,
      hubNodeId: hubId,
      frameColumnId,
    },
  };
}

/** 角色三视图更新后：按脚本出镜 + @ 提示词，刷新所有分镜行参考图 */
export function patchFrameRefImageUrls(
  frameRows: StoryFrameRow[],
  characterRows: StoryCharacterRow[],
): StoryFrameRow[] {
  return frameRows.map((frame) =>
    syncFrameRowCharacterRefs(frame, characterRows),
  );
}

function mergeVideoRowsFromFrames(
  videoRows: StoryVideoRow[],
  frameRows: StoryFrameRow[],
): StoryVideoRow[] {
  return patchVideoRowsFromFrameRows(videoRows, frameRows);
}

/** 角色列 / 分镜列生成后：把上游图同步到分镜参考图与视频首帧 */
export function syncDownstreamMediaColumns(
  nodes: CanvasFlowNode[],
  hubId: string,
  characterColumnId: string,
  frameColumnId: string,
  videoColumnId: string,
): {
  framePatch: { rows: StoryFrameRow[]; hubNodeId: string };
  videoPatch: {
    rows: StoryVideoRow[];
    hubNodeId: string;
    frameColumnId: string;
  };
} | null {
  const synced = syncColumnsFromHub(
    nodes,
    hubId,
    characterColumnId,
    frameColumnId,
    videoColumnId,
  );
  if (!synced) return null;
  const frameRows = patchFrameRefImageUrls(
    synced.framePatch.rows,
    synced.characterPatch.rows,
  );
  const videoRows = mergeVideoRowsFromFrames(synced.videoPatch.rows, frameRows);
  return {
    framePatch: { ...synced.framePatch, rows: frameRows },
    videoPatch: { ...synced.videoPatch, rows: videoRows },
  };
}
