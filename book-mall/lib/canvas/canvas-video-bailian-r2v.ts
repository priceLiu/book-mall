/**
 * Canvas 参考生视频 · 百炼 DashScope R2V（华北2 北京）
 */
import { buildBailianR2vRequestBody } from "@/lib/canvas/bailian-r2v-body";

const CREATE_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis";
const TASK_URL_BASE = "https://dashscope.aliyuncs.com/api/v1/tasks";

export function getDashScopeApiKey(): string | null {
  const dash = process.env.DASHSCOPE_API_KEY?.trim();
  if (dash) return dash;
  return process.env.QWEN_API_KEY?.trim() || null;
}

type I2vCreateResponse = {
  output?: { task_id?: string; task_status?: string };
  code?: string;
  message?: string;
};

export type BailianR2vTaskOutput = {
  task_id?: string;
  task_status?: string;
  video_url?: string;
  code?: string;
  message?: string;
};

export async function bailianR2vCreateTask(opts: {
  apiKey: string;
  model: string;
  prompt: string;
  referenceImageUrls: string[];
  resolution: "720P" | "1080P";
  ratio: string;
  duration: number;
  seedStr?: string;
  parameterExtras?: Record<string, unknown>;
}): Promise<{ ok: true; taskId: string } | { ok: false; error: string }> {
  const prompt = opts.prompt.trim();
  if (!prompt) return { ok: false, error: "提示词不能为空" };

  const urls = opts.referenceImageUrls.map((s) => s.trim()).filter(Boolean);
  if (urls.length < 1 || urls.length > 9) {
    return { ok: false, error: "参考图数量须为 1～9 张" };
  }

  const model = opts.model.trim();
  if (!model) return { ok: false, error: "缺少模型名称" };

  const body = buildBailianR2vRequestBody({
    model,
    prompt,
    referenceImageUrls: urls,
    resolution: opts.resolution,
    ratio: opts.ratio,
    duration: opts.duration,
    seedStr: opts.seedStr,
    parameterExtras: opts.parameterExtras,
  });

  const res = await fetch(CREATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as I2vCreateResponse;
  if (!res.ok) {
    return {
      ok: false,
      error:
        typeof json.message === "string"
          ? json.message
          : `创建参考生视频任务失败（HTTP ${res.status}）`,
    };
  }
  const taskId = json.output?.task_id?.trim();
  if (!taskId) {
    return {
      ok: false,
      error:
        typeof json.message === "string" ? json.message : "接口未返回 task_id",
    };
  }
  return { ok: true, taskId };
}

export async function bailianR2vGetTask(opts: {
  apiKey: string;
  taskId: string;
}): Promise<
  | { ok: true; output: BailianR2vTaskOutput; raw: unknown }
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
  const output = top?.output as BailianR2vTaskOutput | undefined;

  if (!res.ok || !output) {
    const msg =
      typeof top?.message === "string"
        ? top.message
        : `查询任务失败（HTTP ${res.status}）`;
    return { ok: false, error: msg };
  }

  return { ok: true, output, raw };
}
