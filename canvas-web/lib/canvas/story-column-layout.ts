import type {
  StoryCharacterRow,
  StoryFrameRow,
  StoryVideoRow,
} from "./story-workspace-types";
import {
  authoritativeFrameRowsForVideoColumn,
  frameRowsForVideoColumn,
} from "./story-column-display";
import { patchVideoRowsFromFrameRows } from "./story-column-sync";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { NODE_DEFAULT_SIZE } from "./types";

/** 分镜视频列 · 列头横排模型条高度 */
export const STORY_VIDEO_ENGINE_BAR_H = 76;

/** 分镜脚本列 · 列头横排（风格 / @ / IMAGE） */
export const STORY_FRAME_ENGINE_BAR_H = 76;

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

/** 分镜视频列 · 单镜预览区（镜号叠在预览左上角，无底部文案条） */
export const STORY_VIDEO_SLOT = {
  thumbHeight: 248,
  /** @deprecated 镜号已叠在预览上，保留 0 以免旧高度公式多算一节 */
  footerHeight: 0,
  slotGap: 18,
} as const;

export function storyVideoSlotBlockHeight(): number {
  return STORY_VIDEO_SLOT.thumbHeight + STORY_VIDEO_SLOT.footerHeight;
}

/** 分镜视频列 · 每镜 TTS 配音槽 */
export const STORY_TTS_SLOT = {
  labelHeight: 22,
  labelThumbGap: 8,
  thumbHeight: 52,
} as const;

export function storyTtsSlotBlockHeight(): number {
  return (
    STORY_TTS_SLOT.labelHeight +
    STORY_TTS_SLOT.labelThumbGap +
    STORY_TTS_SLOT.thumbHeight
  );
}

/** 视频槽与 TTS 槽之间的间距（计入单行块高） */
export const STORY_VIDEO_INTRA_ROW_GAP = 10;

/** 图3 · 单镜：视频槽 + TTS 槽 */
export function storyVideoRowBlockHeight(): number {
  return (
    storyVideoSlotBlockHeight() +
    STORY_VIDEO_INTRA_ROW_GAP +
    storyTtsSlotBlockHeight()
  );
}

/** @deprecated 使用 storyVideoRowBlockHeight */
export const STORY_VIDEO_ROW_BLOCK_H = storyVideoRowBlockHeight();

/** 列内行列表纵向间距（分镜脚本 / 分镜视频须一致，便于镜 N 对齐） */
export const STORY_MEDIA_ROW_GAP = ROW_GAP;

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

/** 引擎区 · 单列（标签行 + EnginePicker 触发钮 + 段内 gap-1.5） */
export const STORY_ENGINE_LABEL_H = 16;
export const STORY_ENGINE_PICKER_H = 32;
export const STORY_ENGINE_STACK_GAP = 6;
export const STORY_ENGINE_STACK_H =
  STORY_ENGINE_LABEL_H + STORY_ENGINE_STACK_GAP + STORY_ENGINE_PICKER_H;

/** 分镜脚本列 · 引擎面板行数（勾选 | @ 提示 | IMAGE） */
export const STORY_FRAME_SCRIPT_ENGINE_ROW_COUNT = 3;

/** 分镜视频列 · 引擎面板行数（VIDEO | TTS） */
export const STORY_VIDEO_ENGINE_ROW_COUNT = 2;

export function storyEnginePanelH(rowCount: number): number {
  return (
    STORY_ENGINE_STACK_H * rowCount +
    STORY_ENGINE_STACK_GAP * Math.max(0, rowCount - 1)
  );
}

export const STORY_FRAME_SCRIPT_ENGINE_PANEL_H = storyEnginePanelH(
  STORY_FRAME_SCRIPT_ENGINE_ROW_COUNT,
);

export const STORY_VIDEO_ENGINE_PANEL_H = storyEnginePanelH(
  STORY_VIDEO_ENGINE_ROW_COUNT,
);

/** @deprecated 使用 STORY_VIDEO_ENGINE_PANEL_H 或 STORY_FRAME_SCRIPT_ENGINE_PANEL_H */
export const STORY_FRAME_VIDEO_ENGINE_PANEL_H = STORY_VIDEO_ENGINE_PANEL_H;

/** 分镜脚本列 · 动态高度估算后再加，避免 body 内滚动条 */
export const STORY_FRAME_COLUMN_EXTRA_H = 200;

/** 分镜脚本列 · 列头区高（横排引擎条 + 镜列表） */
export function storyFrameScriptHeaderH(_opts?: { pro?: boolean }): number {
  return STORY_COLUMN_SHELL_H + STORY_FRAME_ENGINE_BAR_H + 8;
}

/** @deprecated 纵向三行引擎区 */
export function storyFrameScriptHeaderHLegacy(_opts?: { pro?: boolean }): number {
  return STORY_COLUMN_SHELL_H + STORY_FRAME_SCRIPT_ENGINE_PANEL_H;
}

/** 分镜视频列 · 列头区高（双模型横排 + 镜列表） */
export function storyFrameVideoHeaderH(_opts?: { pro?: boolean }): number {
  return STORY_COLUMN_SHELL_H + STORY_VIDEO_ENGINE_BAR_H + 8;
}

/** @deprecated 纵向双行引擎区；视频列已改横排 {@link STORY_VIDEO_ENGINE_BAR_H} */
export function storyFrameVideoHeaderHLegacy(_opts?: { pro?: boolean }): number {
  return STORY_COLUMN_SHELL_H + STORY_VIDEO_ENGINE_PANEL_H;
}

/** 分镜脚本 · 单格块高 */
export function storyFrameRowBlockHeight(opts?: { pro?: boolean }): number {
  return opts?.pro
    ? STORY_PRO_FRAME_ROW_BLOCK_H
    : STORY_COMIC_FRAME_ROW_BLOCK_H;
}

/** 分镜脚本行 + 分镜视频行 · 纵向对齐用（取较大值） */
export function storyFrameVideoRowBlockH(opts?: { pro?: boolean }): number {
  return Math.max(
    storyFrameRowBlockHeight(opts),
    storyVideoRowBlockHeight(),
  );
}

/** @deprecated 使用 STORY_VIDEO_ENGINE_PANEL_H */
export function storyFrameVideoEngineBodyMinH(_opts?: {
  pro?: boolean;
}): number {
  return STORY_VIDEO_ENGINE_PANEL_H;
}

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
  const count = rows.length;
  const isPro = opts?.pro === true;
  const def = NODE_DEFAULT_SIZE[isPro ? "story-pro-frame" : "story-frame-column"];
  return {
    width: def.width,
    height: storyColumnHeightFromRows(
      storyFrameScriptHeaderH(opts),
      storyFrameRowBlockHeight(opts),
      count,
    ),
  };
}

/** @param frameRowCount 分镜脚本行数（视频列可与分镜列对齐预先撑高） */
export function storyVideoColumnSize(
  rows: StoryVideoRow[],
  frameRowCount?: number,
  opts?: { pro?: boolean },
) {
  const count = Math.max(rows.length, frameRowCount ?? 0);
  const isPro = opts?.pro === true;
  const def = NODE_DEFAULT_SIZE[isPro ? "story-pro-video" : "story-video-column"];
  return {
    width: def.width,
    height: storyColumnHeightFromRows(
      storyFrameVideoHeaderH(opts),
      storyVideoRowBlockHeight(),
      count,
    ),
  };
}

function applyNodeSize(
  n: CanvasFlowNode,
  size: { width: number; height: number },
  minWidth?: number,
): CanvasFlowNode {
  if (Boolean((n.data as { manualSize?: boolean }).manualSize)) {
    return n;
  }
  const width = Math.max(size.width, minWidth ?? 0);
  const height = size.height;
  return {
    ...n,
    width,
    height,
    style: { ...n.style, width, height },
  } as CanvasFlowNode;
}

/** 分镜视频列宽固定 540；高度仍可按 manualSize 保留用户拖拽 */
function applyStoryVideoNodeSize(
  n: CanvasFlowNode,
  size: { width: number; height: number },
  minWidth: number,
  dataPatch?: Record<string, unknown>,
): CanvasFlowNode {
  const width = Math.max(size.width, minWidth);
  const manual = Boolean((n.data as { manualSize?: boolean }).manualSize);
  const height = manual
    ? Number(n.style?.height ?? n.height ?? size.height) || size.height
    : size.height;
  return {
    ...n,
    data: dataPatch ? { ...n.data, ...dataPatch } : n.data,
    width,
    height,
    style: { ...n.style, width, height },
  } as CanvasFlowNode;
}

function applyStoryComicColumnHeights(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[] = [],
): CanvasFlowNode[] {
  const charDef = NODE_DEFAULT_SIZE["story-character-column"].width;
  const frameDef = NODE_DEFAULT_SIZE["story-frame-column"].width;
  const videoDef = NODE_DEFAULT_SIZE["story-video-column"].width;

  return nodes.map((n) => {
    if (n.type === "story-character-column") {
      const charRows =
        ((n.data as { rows?: StoryCharacterRow[] })?.rows as StoryCharacterRow[]) ??
        [];
      const charSize = storyCharacterColumnSize(charRows, { pro: false });
      return applyNodeSize(n, charSize, charDef);
    }
    if (n.type === "story-frame-column") {
      const frameRows = authoritativeFrameRowsForVideoColumn(nodes, n.id, edges);
      const frameSize = storyFrameColumnSize(frameRows, { pro: false });
      return applyNodeSize(n, frameSize, frameDef);
    }
    if (n.type === "story-video-column") {
      const { frameColumnId, frameRows } = frameRowsForVideoColumn(
        nodes,
        edges,
        n.id,
      );
      const videoStored =
        ((n.data as { rows?: StoryVideoRow[] })?.rows as StoryVideoRow[]) ?? [];
      const videoRows = frameRows.length
        ? patchVideoRowsFromFrameRows(videoStored, frameRows)
        : videoStored;
      const videoSize = storyVideoColumnSize(videoRows, frameRows.length, {
        pro: false,
      });
      return applyStoryVideoNodeSize(n, videoSize, videoDef, {
        rows: videoRows,
        frameColumnId,
      });
    }
    return n;
  });
}

function applyStoryProColumnHeights(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[] = [],
): CanvasFlowNode[] {
  const charDef = NODE_DEFAULT_SIZE["story-pro-character"].width;
  const frameDef = NODE_DEFAULT_SIZE["story-pro-frame"].width;
  const videoDef = NODE_DEFAULT_SIZE["story-pro-video"].width;

  return nodes.map((n) => {
    if (n.type === "story-pro-character") {
      const charRows =
        ((n.data as { rows?: StoryCharacterRow[] })?.rows as StoryCharacterRow[]) ??
        [];
      const charSize = storyCharacterColumnSize(charRows, { pro: true });
      return applyNodeSize(n, charSize, charDef);
    }
    if (n.type === "story-pro-frame") {
      const frameRows = authoritativeFrameRowsForVideoColumn(nodes, n.id, edges);
      const frameSize = storyFrameColumnSize(frameRows, { pro: true });
      return applyNodeSize(n, frameSize, frameDef);
    }
    if (n.type === "story-pro-video") {
      const { frameColumnId, frameRows } = frameRowsForVideoColumn(
        nodes,
        edges,
        n.id,
      );
      const videoStored =
        ((n.data as { rows?: StoryVideoRow[] })?.rows as StoryVideoRow[]) ?? [];
      const videoRows = frameRows.length
        ? patchVideoRowsFromFrameRows(videoStored, frameRows)
        : videoStored;
      const videoSize = storyVideoColumnSize(videoRows, frameRows.length, {
        pro: true,
      });
      return applyStoryVideoNodeSize(n, videoSize, videoDef, {
        rows: videoRows,
        frameColumnId,
      });
    }
    return n;
  });
}

/** 按 rows 数量估算列高（快手 / 专业版分别计算，互不混用） */
export function applyStoryColumnHeights(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[] = [],
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
  if (hasComicMedia) next = applyStoryComicColumnHeights(next, edges);
  if (hasProMedia) next = applyStoryProColumnHeights(next, edges);
  return next;
}

export function isStoryMediaColumnType(type: string | undefined): boolean {
  return type != null && STORY_MEDIA_COLUMN_TYPES.has(type);
}
