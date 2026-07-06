/** 剪辑成片 / 自动成片播放器 · 按视频比例适配节点外框（无标题栏） */

export const CLIP_PLAYER_MAX_LONG_EDGE = 420;
export const CLIP_PLAYER_MIN_WIDTH = 260;
export const CLIP_PLAYER_MIN_HEIGHT = 146;

/** 自动成片节点 · 默认比 clip preview 大 1 倍（Dock 尺寸不变） */
export const AUTO_RENDER_PLAYER_MAX_LONG_EDGE = CLIP_PLAYER_MAX_LONG_EDGE * 2;
export const AUTO_RENDER_PLAYER_MIN_WIDTH = CLIP_PLAYER_MIN_WIDTH * 2;
export const AUTO_RENDER_PLAYER_MIN_HEIGHT = CLIP_PLAYER_MIN_HEIGHT * 2;

export function computeClipPreviewNodeSize(naturalWidth: number, naturalHeight: number) {
  const nw = Math.max(1, naturalWidth);
  const nh = Math.max(1, naturalHeight);
  const ratio = nw / nh;
  let width: number;
  let height: number;
  if (ratio >= 1) {
    width = CLIP_PLAYER_MAX_LONG_EDGE;
    height = Math.ceil(CLIP_PLAYER_MAX_LONG_EDGE / ratio);
  } else {
    height = CLIP_PLAYER_MAX_LONG_EDGE;
    width = Math.ceil(CLIP_PLAYER_MAX_LONG_EDGE * ratio);
  }
  return {
    width: Math.max(CLIP_PLAYER_MIN_WIDTH, width),
    height: Math.max(CLIP_PLAYER_MIN_HEIGHT, height),
  };
}

/** 自动成片节点 = 播放器区尺寸（Dock 为浮动，不计入节点高度） */
export function computeAutoRenderNodeSize(
  naturalWidth: number,
  naturalHeight: number,
) {
  const nw = Math.max(1, naturalWidth);
  const nh = Math.max(1, naturalHeight);
  const ratio = nw / nh;
  let width: number;
  let height: number;
  if (ratio >= 1) {
    width = AUTO_RENDER_PLAYER_MAX_LONG_EDGE;
    height = Math.ceil(AUTO_RENDER_PLAYER_MAX_LONG_EDGE / ratio);
  } else {
    height = AUTO_RENDER_PLAYER_MAX_LONG_EDGE;
    width = Math.ceil(AUTO_RENDER_PLAYER_MAX_LONG_EDGE * ratio);
  }
  return {
    width: Math.max(AUTO_RENDER_PLAYER_MIN_WIDTH, width),
    height: Math.max(AUTO_RENDER_PLAYER_MIN_HEIGHT, height),
  };
}
