export function clamp999(n: number): number {
  return Math.max(0, Math.min(999, Math.round(n)));
}

export function denormalizedBboxToNatural(
  bbox: [number, number, number, number],
  width: number,
  height: number,
): [number, number, number, number] {
  if (width <= 0 || height <= 0) {
    return [0, 0, 0, 0];
  }
  return [
    (bbox[0] / 1000) * width,
    (bbox[1] / 1000) * height,
    (bbox[2] / 1000) * width,
    (bbox[3] / 1000) * height,
  ];
}

export function normalizeBboxTuple(
  bbox: [number, number, number, number],
): [number, number, number, number] {
  let x1 = clamp999(Math.min(bbox[0], bbox[2]));
  let y1 = clamp999(Math.min(bbox[1], bbox[3]));
  let x2 = clamp999(Math.max(bbox[0], bbox[2]));
  let y2 = clamp999(Math.max(bbox[1], bbox[3]));
  if (x2 <= x1) x2 = Math.min(999, x1 + 1);
  if (y2 <= y1) y2 = Math.min(999, y1 + 1);
  return [x1, y1, x2, y2];
}

export function normalizedBbox(
  x1Px: number,
  y1Px: number,
  x2Px: number,
  y2Px: number,
  width: number,
  height: number,
): [number, number, number, number] {
  if (width <= 0 || height <= 0) {
    return [0, 0, 0, 0];
  }
  const x1 = Math.min(x1Px, x2Px);
  const y1 = Math.min(y1Px, y2Px);
  const x2 = Math.max(x1Px, x2Px);
  const y2 = Math.max(y1Px, y2Px);
  return normalizeBboxTuple([
    (x1 / width) * 1000,
    (y1 / height) * 1000,
    (x2 / width) * 1000,
    (y2 / height) * 1000,
  ]);
}

function bboxTag(b: [number, number, number, number]): string {
  const t = normalizeBboxTuple(b);
  return `<bbox>${t[0]} ${t[1]} ${t[2]} ${t[3]}</bbox>`;
}

/** 与 book-mall ecom-image-layer-prompt 保持一致 */
export function buildDecomposePrompt(
  bboxes: Array<[number, number, number, number]>,
): string {
  const hint =
    "已分离的人物和物体须从底图移除，空位按原图场景、光影与桌面自然补全；房间环境保持不变，禁止换成空白、纯色或新背景。";
  if (bboxes.length === 0) {
    return `将图片进行精确图层分离，对图片做完整图层语义分离。${hint}`;
  }
  if (bboxes.length === 1) {
    return `将图片进行精确图层分离，需分离的区域坐标为 ${bboxTag(bboxes[0]!)}。${hint}`;
  }
  const parts = bboxes.map((b, i) => `区域${i + 1}${bboxTag(b)}`);
  return `将图片进行精确图层分离，需分离的${parts.join("、")}。${hint}`;
}

export function buildEditPrompt(
  bbox: [number, number, number, number],
  userText: string,
): string {
  const text = userText.trim();
  return `把图 1 ${bboxTag(bbox)} 区域${text}`;
}
