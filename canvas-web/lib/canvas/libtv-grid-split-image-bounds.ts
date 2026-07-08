/** object-contain · 图片在 stage 内的实际显示区域（宫格须贴齐此区域） */

export type ContainedImageBounds = {
  width: number;
  height: number;
};

export function computeContainedImageBounds(
  stageWidth: number,
  stageHeight: number,
  naturalWidth: number,
  naturalHeight: number,
): ContainedImageBounds {
  const sw = Math.max(1, stageWidth);
  const sh = Math.max(1, stageHeight);
  const nw = Math.max(1, naturalWidth);
  const nh = Math.max(1, naturalHeight);
  const scale = Math.min(sw / nw, sh / nh);
  return {
    width: Math.max(1, Math.round(nw * scale)),
    height: Math.max(1, Math.round(nh * scale)),
  };
}
