export const AUTO_DECOMPOSE_PROMPT =
  "将图片进行精确图层分离，对图片做完整图层语义分离。";

/** 0～999 归一化 bbox 在 999 刻度下的最小宽高（约 1% 画幅） */
export const DECOMPOSE_BBOX_MIN_SPAN = 10;

export function clamp999(n: number): number {
  return Math.max(0, Math.min(999, Math.round(n)));
}

/** 保证 x1<x2、y1<y2，坐标在 0～999 */
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

export function validateDecomposeBboxes(
  bboxes: Array<[number, number, number, number]>,
): void {
  if (bboxes.length === 0) return;
  for (let i = 0; i < bboxes.length; i++) {
    const [x1, y1, x2, y2] = normalizeBboxTuple(bboxes[i]!);
    const w = x2 - x1;
    const h = y2 - y1;
    if (w < DECOMPOSE_BBOX_MIN_SPAN || h < DECOMPOSE_BBOX_MIN_SPAN) {
      throw new Error(
        `第 ${i + 1} 个框选区域过小，请框住完整物体后再拆分（当前约 ${w}×${h}/999）`,
      );
    }
  }
}

function bboxTag(b: [number, number, number, number]): string {
  const t = normalizeBboxTuple(b);
  return `<bbox>${t[0]} ${t[1]} ${t[2]} ${t[3]}</bbox>`;
}

/**
 * 图层拆分 prompt（对齐官方 / Evolink 示例：每个区域名前附 <bbox>，多框用 、连接）
 * @see docs/图片分层.md §5.1
 */
export function buildDecomposePrompt(
  bboxes: Array<[number, number, number, number]>,
): string {
  if (bboxes.length === 0) return AUTO_DECOMPOSE_PROMPT;

  if (bboxes.length === 1) {
    return `将图片进行精确图层分离，需分离的区域坐标为 ${bboxTag(bboxes[0]!)}。`;
  }

  const parts = bboxes.map((b, i) => `区域${i + 1}${bboxTag(b)}`);
  return `将图片进行精确图层分离，需分离的${parts.join("、")}。`;
}

export function buildEditPrompt(
  bbox: [number, number, number, number],
  userText: string,
): string {
  const text = userText.trim();
  return `把图 1 ${bboxTag(bbox)} 区域${text}`;
}

/** 多区域交互编辑：各区域一句，用顿号连接（对齐官方多主体示例） */
export function buildBatchEditPrompt(
  jobs: Array<{ bbox: [number, number, number, number]; prompt: string }>,
): string {
  if (jobs.length === 0) throw new Error("缺少编辑区域");
  if (jobs.length === 1) {
    return buildEditPrompt(jobs[0]!.bbox, jobs[0]!.prompt);
  }
  return jobs
    .map((j) => `把图 1 ${bboxTag(j.bbox)} 区域${j.prompt.trim()}`)
    .join("；");
}
