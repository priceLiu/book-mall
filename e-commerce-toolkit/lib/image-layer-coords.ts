export function clamp999(n: number): number {
  return Math.max(0, Math.min(999, Math.round(n)));
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
  return [
    clamp999((x1Px / width) * 1000),
    clamp999((y1Px / height) * 1000),
    clamp999((x2Px / width) * 1000),
    clamp999((y2Px / height) * 1000),
  ];
}

export function buildDecomposePrompt(
  bboxes: Array<[number, number, number, number]>,
): string {
  if (bboxes.length === 0) {
    return "将图片进行精确图层分离，对图片做完整图层语义分离。";
  }
  const tags = bboxes
    .map(
      (b) =>
        `<bbox>${clamp999(b[0])} ${clamp999(b[1])} ${clamp999(b[2])} ${clamp999(b[3])}</bbox>`,
    )
    .join("、");
  return `将图片进行精确图层分离，需分离的区域坐标为 ${tags}。`;
}

export function buildEditPrompt(
  bbox: [number, number, number, number],
  userText: string,
): string {
  const text = userText.trim();
  const tag = `<bbox>${clamp999(bbox[0])} ${clamp999(bbox[1])} ${clamp999(bbox[2])} ${clamp999(bbox[3])}</bbox>`;
  return `把图 1 ${tag} 区域${text}`;
}
