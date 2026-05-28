import type {
  StoryCharacterRow,
  StoryFrameRow,
  StoryVideoRow,
} from "./story-workspace-types";
import type { CanvasFlowNode } from "./types";
import { NODE_DEFAULT_SIZE } from "./types";

/** 节点壳：标题栏 + 内边距（与 NodeShell 实测近似） */
const SHELL_CHROME = 52;
const BODY_PAD = 28;
const ROW_GAP = 12;
const ENGINE_BLOCK = 76;
export const STORY_COLUMN_MIN_H = 2100;
/** @deprecated 与 STORY_COLUMN_MIN_H 同义，保留兼容 */
export const STORY_COLUMN_VIEWPORT_H = STORY_COLUMN_MIN_H;

/** 行数公式尾部留白（含底栏批量按钮区） */
export const STORY_COLUMN_TAIL_PAD = 100;

/**
 * 图1 · 影视专业版 · 单角色行块高（248px 预览 + 四槽 + 音频，实测近似）
 */
export const STORY_PRO_CHARACTER_ROW_BLOCK_H = 620;

/**
 * 图1 · 快手漫剧 · 单角色行块高（248px 预览 + 卡片 chrome）
 */
export const STORY_COMIC_CHARACTER_ROW_BLOCK_H = 300;

/** 图2 · 单分镜脚本行块高（248px 预览 + prompt + pro 建议条） */
export const STORY_COMIC_FRAME_ROW_BLOCK_H = 290;

/** 分镜行 · 主内容带（文案 + 参考图 + 输出图，同高） */
export const STORY_FRAME_ROW_STRIP_H = 248;

/** @deprecated 与 STORY_FRAME_ROW_STRIP_H 同义 */
export const STORY_FRAME_ROW_PROMPT_H = STORY_FRAME_ROW_STRIP_H;

/** 分镜行 · pro 建议 @ / 资产就绪条预留高 */
export const STORY_FRAME_ROW_BELOW_PROMPT_H = 56;

/** 图2 · 影视专业版分镜行（内容带 + pro 建议条 + 卡片边距） */
export const STORY_PRO_FRAME_ROW_BLOCK_H =
  STORY_FRAME_ROW_STRIP_H + STORY_FRAME_ROW_BELOW_PROMPT_H + 24;

/** 分镜视频列 · 单镜块（与 story-video-row-slot 同步） */
export const STORY_VIDEO_SLOT = {
  labelHeight: 24,
  labelThumbGap: 10,
  thumbHeight: 248,
  slotGap: 18,
} as const;

export function storyVideoSlotBlockHeight(): number {
  return (
    STORY_VIDEO_SLOT.labelHeight +
    STORY_VIDEO_SLOT.labelThumbGap +
    STORY_VIDEO_SLOT.thumbHeight
  );
}

/** 图3 · 单分镜视频槽块高 */
export const STORY_VIDEO_ROW_BLOCK_H = storyVideoSlotBlockHeight();

const STORY_MEDIA_COLUMN_TYPES = new Set([
  "story-character-column",
  "story-frame-column",
  "story-video-column",
  "story-pro-character",
  "story-pro-frame",
  "story-pro-video",
]);

/** 节点标题栏 + body 顶区内边距（不含 footer） */
const STORY_COLUMN_SHELL_H = SHELL_CHROME + BODY_PAD;

/** 人物列：shell + 单 IMAGE 引擎区 */
const STORY_CHAR_HEADER_H = STORY_COLUMN_SHELL_H + ENGINE_BLOCK + 20;

/** 分镜列：shell +（pro 风格勾选）+ 单 IMAGE 引擎 */
function storyFrameHeaderH(pro?: boolean): number {
  return STORY_COLUMN_SHELL_H + ENGINE_BLOCK + 20 + (pro ? 28 : 0);
}

/** 分镜视频列：shell + 单 VIDEO 引擎区 */
const STORY_VIDEO_HEADER_H = STORY_COLUMN_SHELL_H + ENGINE_BLOCK + 20;

function storyColumnHeightFromRows(
  headerH: number,
  rowBlockH: number,
  rowCount: number,
): number {
  if (rowCount <= 0) return STORY_COLUMN_MIN_H;
  const listH =
    rowCount * rowBlockH + Math.max(0, rowCount - 1) * ROW_GAP;
  const calculated = headerH + listH + STORY_COLUMN_TAIL_PAD;
  return Math.max(STORY_COLUMN_MIN_H, calculated);
}

export function storyCharacterColumnSize(
  rows: StoryCharacterRow[],
  opts?: { pro?: boolean },
) {
  const def = NODE_DEFAULT_SIZE["story-character-column"];
  const blockH = opts?.pro
    ? STORY_PRO_CHARACTER_ROW_BLOCK_H
    : STORY_COMIC_CHARACTER_ROW_BLOCK_H;
  return {
    width: def.width,
    height: storyColumnHeightFromRows(
      STORY_CHAR_HEADER_H,
      blockH,
      rows.length,
    ),
  };
}

export function storyFrameColumnSize(
  rows: StoryFrameRow[],
  opts?: { pro?: boolean },
) {
  const def = NODE_DEFAULT_SIZE["story-frame-column"];
  const blockH = opts?.pro
    ? STORY_PRO_FRAME_ROW_BLOCK_H
    : STORY_COMIC_FRAME_ROW_BLOCK_H;
  return {
    width: def.width,
    height: storyColumnHeightFromRows(
      storyFrameHeaderH(opts?.pro),
      blockH,
      rows.length,
    ),
  };
}

/** @param frameRowCount 分镜脚本行数（视频列可与分镜列对齐预先撑高） */
export function storyVideoColumnSize(
  rows: StoryVideoRow[],
  frameRowCount?: number,
) {
  const def = NODE_DEFAULT_SIZE["story-video-column"];
  const count = Math.max(rows.length, frameRowCount ?? 0);
  return {
    width: def.width,
    height: storyColumnHeightFromRows(
      STORY_VIDEO_HEADER_H,
      STORY_VIDEO_ROW_BLOCK_H,
      count,
    ),
  };
}

function applyNodeSize(
  n: CanvasFlowNode,
  size: { width: number; height: number },
  minWidth?: number,
): CanvasFlowNode {
  const width = Math.max(size.width, minWidth ?? 0);
  const height = size.height;
  return {
    ...n,
    width,
    height,
    style: { ...n.style, width, height },
  } as CanvasFlowNode;
}

function applyStoryComicColumnHeights(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  const char = nodes.find((n) => n.type === "story-character-column");
  const frame = nodes.find((n) => n.type === "story-frame-column");
  const video = nodes.find((n) => n.type === "story-video-column");

  const charRows =
    ((char?.data as { rows?: StoryCharacterRow[] })?.rows as StoryCharacterRow[]) ??
    [];
  const frameRows =
    ((frame?.data as { rows?: StoryFrameRow[] })?.rows as StoryFrameRow[]) ?? [];
  const videoRows =
    ((video?.data as { rows?: StoryVideoRow[] })?.rows as StoryVideoRow[]) ?? [];

  const charSize = char ? storyCharacterColumnSize(charRows, { pro: false }) : null;
  const frameSize = frame ? storyFrameColumnSize(frameRows, { pro: false }) : null;
  const videoSize = video
    ? storyVideoColumnSize(videoRows, frameRows.length)
    : null;

  const charDef = NODE_DEFAULT_SIZE["story-character-column"].width;
  const frameDef = NODE_DEFAULT_SIZE["story-frame-column"].width;
  const videoDef = NODE_DEFAULT_SIZE["story-video-column"].width;

  return nodes.map((n) => {
    if (n.id === char?.id && charSize) return applyNodeSize(n, charSize, charDef);
    if (n.id === frame?.id && frameSize) return applyNodeSize(n, frameSize, frameDef);
    if (n.id === video?.id && videoSize) return applyNodeSize(n, videoSize, videoDef);
    return n;
  });
}

function applyStoryProColumnHeights(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  const char = nodes.find((n) => n.type === "story-pro-character");
  const frame = nodes.find((n) => n.type === "story-pro-frame");
  const video = nodes.find((n) => n.type === "story-pro-video");

  const charRows =
    ((char?.data as { rows?: StoryCharacterRow[] })?.rows as StoryCharacterRow[]) ??
    [];
  const frameRows =
    ((frame?.data as { rows?: StoryFrameRow[] })?.rows as StoryFrameRow[]) ?? [];
  const videoRows =
    ((video?.data as { rows?: StoryVideoRow[] })?.rows as StoryVideoRow[]) ?? [];

  const charSize = char ? storyCharacterColumnSize(charRows, { pro: true }) : null;
  const frameSize = frame ? storyFrameColumnSize(frameRows, { pro: true }) : null;
  const videoSize = video
    ? storyVideoColumnSize(videoRows, frameRows.length)
    : null;

  const charDef = NODE_DEFAULT_SIZE["story-pro-character"].width;
  const frameDef = NODE_DEFAULT_SIZE["story-pro-frame"].width;
  const videoDef = NODE_DEFAULT_SIZE["story-pro-video"].width;

  return nodes.map((n) => {
    if (n.id === char?.id && charSize) return applyNodeSize(n, charSize, charDef);
    if (n.id === frame?.id && frameSize) return applyNodeSize(n, frameSize, frameDef);
    if (n.id === video?.id && videoSize) return applyNodeSize(n, videoSize, videoDef);
    return n;
  });
}

/** 按 rows 数量估算列高（快手 / 专业版分别计算，互不混用） */
export function applyStoryColumnHeights(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  let next = nodes;
  const hasComicMedia = nodes.some(
    (n) =>
      n.type === "story-character-column" ||
      n.type === "story-frame-column" ||
      n.type === "story-video-column",
  );
  const hasProMedia = nodes.some(
    (n) =>
      n.type === "story-pro-character" ||
      n.type === "story-pro-frame" ||
      n.type === "story-pro-video",
  );
  if (hasComicMedia) next = applyStoryComicColumnHeights(next);
  if (hasProMedia) next = applyStoryProColumnHeights(next);
  return next;
}

export function isStoryMediaColumnType(type: string | undefined): boolean {
  return type != null && STORY_MEDIA_COLUMN_TYPES.has(type);
}
