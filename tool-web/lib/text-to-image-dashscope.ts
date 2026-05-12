/** 阿里云 DashScope 文生图异步 HTTP API（见 doc/qwen-wx.md） */

export const WANX_TEXT2IMAGE_PLUS_MODEL = "wanx2.1-t2i-plus";

const CREATE_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis";
const TASK_URL_BASE = "https://dashscope.aliyuncs.com/api/v1/tasks";

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

export type WanxCreateResponse = {
  output?: { task_id?: string; task_status?: string };
  code?: string;
  message?: string;
  request_id?: string;
};

export async function wanxCreateTextToImageTask(opts: {
  apiKey: string;
  prompt: string;
  negativePrompt?: string;
  /** 1–4，与文档一致 */
  n: number;
}): Promise<{ ok: true; taskId: string } | { ok: false; error: string }> {
  const prompt = opts.prompt.trim();
  if (!prompt) return { ok: false, error: "prompt 不能为空" };

  const n = Math.min(4, Math.max(1, Math.floor(opts.n)));

  const res = await fetch(CREATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model: WANX_TEXT2IMAGE_PLUS_MODEL,
      input: {
        prompt,
        ...(opts.negativePrompt?.trim()
          ? { negative_prompt: opts.negativePrompt.trim().slice(0, 500) }
          : {}),
      },
      parameters: {
        size: "1024*1024",
        n,
        prompt_extend: true,
        watermark: false,
      },
    }),
  });

  const json = (await res.json()) as WanxCreateResponse;
  if (!res.ok) {
    return {
      ok: false,
      error:
        typeof json.message === "string"
          ? json.message
          : `创建任务失败（HTTP ${res.status}）`,
    };
  }
  const taskId = json.output?.task_id?.trim();
  if (!taskId) {
    const msg =
      typeof json.message === "string"
        ? json.message
        : "接口未返回 task_id";
    return { ok: false, error: msg };
  }
  return { ok: true, taskId };
}

export async function wanxGetTextImageTask(opts: {
  apiKey: string;
  taskId: string;
}): Promise<
  | { ok: true; output: WanxTaskPollOutput; raw: unknown }
  | { ok: false; error: string }
> {
  const taskId = opts.taskId.trim();
  if (!taskId) return { ok: false, error: "缺少 task_id" };

  const res = await fetch(`${TASK_URL_BASE}/${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${opts.apiKey}` },
    cache: "no-store",
  });

  const raw = await res.json().catch(() => null);
  const top = raw as Record<string, unknown> | null;
  const output = top?.output as WanxTaskPollOutput | undefined;

  if (!res.ok || !output) {
    const msg =
      typeof top?.message === "string"
        ? top.message
        : `查询任务失败（HTTP ${res.status}）`;
    return { ok: false, error: msg };
  }

  return { ok: true, output, raw };
}
