/** 文生图 · Gateway 任务输出类型与模型常量（厂商 HTTP 由 book-mall Gateway 出站） */

export const WANX_TEXT2IMAGE_PLUS_MODEL = "wanx2.1-t2i-plus";

export type WanxTaskPollOutput = {
  task_id?: string;
  task_status?: string;
  submit_time?: string;
  scheduled_time?: string;
  end_time?: string;
  results?: Array<{
    url?: string;
    orig_prompt?: string;
    actual_prompt?: string;
    code?: string;
    message?: string;
  }>;
  task_metrics?: { TOTAL?: number; SUCCEEDED?: number; FAILED?: number };
  code?: string;
  message?: string;
};

/** 成功任务计费张数：优先 results 中带 url 的条数，否则 task_metrics，默认 1。 */
export function countWanxSucceededImages(output: WanxTaskPollOutput): number {
  const urls =
    output.results?.map((r) => r.url).filter((u) => typeof u === "string" && u.trim()) ?? [];
  if (urls.length > 0) return urls.length;
  const t = output.task_metrics?.SUCCEEDED;
  if (typeof t === "number" && t > 0) return Math.min(4, t);
  const total = output.task_metrics?.TOTAL;
  if (typeof total === "number" && total > 0) return Math.min(4, total);
  return 1;
}
