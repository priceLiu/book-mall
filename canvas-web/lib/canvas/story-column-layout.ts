import { storyRefIdsFromPrompt } from "./story-ref-image";
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
const ENGINE_BLOCK = 76;
/** 与 story-node-footer-shell 底栏内容区一致（按钮 + gap + 提示占位） */
const FOOTER_BTN = 60;
const ROW_GAP = 12;
const ROW_CARD_CHROME = 32;
const MEDIA_COL_MIN = 248;
const UPSTREAM_REF_SLOT_H = 100;
const COLUMN_EXTRA_PAD = 48;
const CHARS_PER_LINE_FRAME = 56;
const CHARS_PER_LINE_CHAR = 38;

const EMPTY_LIST = 72;
const MIN_COL_H_EMPTY = 400;
/** 节点外框固定高度；角色/分镜列内容超出时在 NodeShell bodyScroll 内滚 */
export const STORY_COLUMN_VIEWPORT_H = 2100;

function estimatePromptHeight(text: string, charsPerLine = 42): number {
  const t = text.trim();
  if (!t) return 80;
  const lines = t.split("\n").length;
  const wrapped = Math.ceil(t.length / Math.max(charsPerLine, 20));
  const lineCount = Math.max(lines, wrapped);
  return Math.max(80, Math.min(420, lineCount * 16 + 32));
}

function frameRefSlotCount(row: StoryFrameRow): number {
  return Math.max(
    storyRefIdsFromPrompt(row.prompt ?? "").length,
    row.refImages?.length ?? 0,
    row.referencedNodeIds?.length ?? 0,
  );
}

function characterRowHeight(row: StoryCharacterRow): number {
  return (
    Math.max(
      estimatePromptHeight(row.prompt ?? "", CHARS_PER_LINE_CHAR),
      MEDIA_COL_MIN,
    ) + ROW_CARD_CHROME
  );
}

function frameRowHeight(row: StoryFrameRow): number {
  const refCount = frameRefSlotCount(row);
  const upstreamH =
    refCount > 0
      ? Math.max(
          MEDIA_COL_MIN,
          refCount * UPSTREAM_REF_SLOT_H + Math.max(0, refCount - 1) * 8,
        )
      : MEDIA_COL_MIN;
  return (
    Math.max(
      estimatePromptHeight(row.prompt ?? "", CHARS_PER_LINE_FRAME),
      upstreamH,
      MEDIA_COL_MIN,
    ) + ROW_CARD_CHROME
  );
}

/** 分镜视频列 · 固定格高（与 story-video-row-slot 一致，用于节点高度推算） */
export const STORY_VIDEO_SLOT = {
  labelHeight: 22,
  labelThumbGap: 8,
  thumbHeight: 200,
  slotGap: 16,
} as const;

export function storyVideoSlotBlockHeight(): number {
  return (
    STORY_VIDEO_SLOT.labelHeight +
    STORY_VIDEO_SLOT.labelThumbGap +
    STORY_VIDEO_SLOT.thumbHeight
  );
}

function storyVideoListHeight(count: number): number {
  if (count <= 0) return EMPTY_LIST;
  const block = storyVideoSlotBlockHeight();
  return count * block + (count - 1) * STORY_VIDEO_SLOT.slotGap;
}

const VIDEO_COLUMN_BODY_PAD = 16;

function storyVideoColumnContentHeight(rowCount: number): number {
  return SHELL_CHROME + BODY_PAD + VIDEO_COLUMN_BODY_PAD + storyVideoListHeight(rowCount);
}

function columnContentHeight(
  rowHeights: number[],
  extraBlocks = 1,
  extraBody = 0,
): number {
  const list =
    rowHeights.length > 0
      ? rowHeights.reduce((sum, h, i) => sum + h + (i > 0 ? ROW_GAP : 0), 0)
      : EMPTY_LIST;
  return (
    SHELL_CHROME +
    BODY_PAD +
    COLUMN_EXTRA_PAD +
    extraBlocks * ENGINE_BLOCK +
    FOOTER_BTN +
    extraBody +
    list
  );
}

function columnHeight(
  rowHeights: number[],
  extraBlocks = 1,
  extraBody = 0,
): number {
  const raw = columnContentHeight(rowHeights, extraBlocks, extraBody);
  if (rowHeights.length === 0) {
    return Math.min(Math.max(raw, MIN_COL_H_EMPTY), STORY_COLUMN_VIEWPORT_H);
  }
  return Math.min(Math.max(raw, 360), STORY_COLUMN_VIEWPORT_H);
}

export function storyCharacterColumnSize(_rows: StoryCharacterRow[]) {
  const def = NODE_DEFAULT_SIZE["story-character-column"];
  return { width: def.width, height: def.height };
}

export function storyFrameColumnSize(_rows: StoryFrameRow[]) {
  const def = NODE_DEFAULT_SIZE["story-frame-column"];
  return { width: def.width, height: def.height };
}

/** @param frameRowCount 分镜脚本行数（与视频列对齐，用于输出工作流后预先撑高） */
export function storyVideoColumnSize(
  _rows: StoryVideoRow[],
  _frameRowCount?: number,
) {
  const def = NODE_DEFAULT_SIZE["story-video-column"];
  return { width: def.width, height: def.height };
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

/** 按 rows 内容与提示词行数估算列高，减少底部空白 */
export function applyStoryColumnHeights(
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

  const charSize = char ? storyCharacterColumnSize(charRows) : null;
  const frameSize = frame ? storyFrameColumnSize(frameRows) : null;
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
