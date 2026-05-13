/**
 * 阿里云 DashScope · 视频合成（华北2 北京）：图生 i2v、参考生 r2v、文生 t2v
 * 文档：doc/pic-video.md、doc/chanaosheng.md
 */

const CREATE_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis";
const TASK_URL_BASE = "https://dashscope.aliyuncs.com/api/v1/tasks";

export const HAPPYHORSE_R2V_MODEL = "happyhorse-1.0-r2v";

export type I2vTaskOutput = {
  task_id?: string;
  task_status?: string;
  submit_time?: string;
  scheduled_time?: string;
  end_time?: string;
  video_url?: string;
  orig_prompt?: string;
  code?: string;
  message?: string;
};

export type I2vCreateResponse = {
  output?: { task_id?: string; task_status?: string };
  code?: string;
  message?: string;
  request_id?: string;
};

function parseSeed(raw: string | undefined): number | undefined {
  if (raw == null) return undefined;
  const t = String(raw).trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return undefined;
  if (n < 0 || n > 2147483647) return undefined;
  return n;
}

export async function i2vCreateVideoTask(opts: {
  apiKey: string;
  /** DashScope 请求体 model，如 happyhorse-1.0-i2v、wan2.7-i2v-2026-04-25 */
  model: string;
  prompt: string;
  /** 公网 HTTPS URL 或 data:image/...;base64,... */
  firstFrame: string;
  resolution: "720P" | "1080P";
  duration: number;
  seedStr?: string;
  watermark?: boolean;
  /** 与 resolution / duration 等合并；后者可覆盖同名键 */
  parameterExtras?: Record<string, unknown>;
}): Promise<{ ok: true; taskId: string } | { ok: false; error: string }> {
  const prompt = opts.prompt.trim();
  if (!prompt) return { ok: false, error: "提示词不能为空" };

  const first = opts.firstFrame.trim();
  if (!first) return { ok: false, error: "缺少首帧图片" };
  if (first.length > 28_000_000) {
    return { ok: false, error: "首帧数据过大，请使用较小图片或公网 URL" };
  }
  const isData = first.startsWith("data:image/");
  const isHttp =
    first.startsWith("https://") || first.startsWith("http://");
  if (!isData && !isHttp) {
    return {
      ok: false,
      error: "首帧须为公网图片 URL 或本地读取后的 Data URL",
    };
  }

  const duration = Math.min(15, Math.max(3, Math.floor(opts.duration)));
  const seed = parseSeed(opts.seedStr);

  const model = opts.model.trim();
  if (!model) return { ok: false, error: "缺少模型名称" };

  const parameters: Record<string, unknown> = {
    ...(opts.parameterExtras ?? {}),
    resolution: opts.resolution,
    duration,
    watermark: opts.watermark ?? false,
  };
  if (seed != null) parameters.seed = seed;

  const body = {
    model,
    input: {
      prompt,
      media: [{ type: "first_frame", url: first }],
    },
    parameters,
  };

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
          : `创建任务失败（HTTP ${res.status}）`,
    };
  }
  const taskId = json.output?.task_id?.trim();
  if (!taskId) {
    const msg =
      typeof json.message === "string" ? json.message : "接口未返回 task_id";
    return { ok: false, error: msg };
  }
  return { ok: true, taskId };
}

function validateImageRef(
  label: string,
  url: string,
): { ok: true } | { ok: false; error: string } {
  const u = url.trim();
  if (!u) return { ok: false, error: `${label}不能为空` };
  if (u.length > 28_000_000) {
    return { ok: false, error: `${label}数据过大，请使用较小图片或公网 URL` };
  }
  const isData = u.startsWith("data:image/");
  const isHttp = u.startsWith("https://") || u.startsWith("http://");
  if (!isData && !isHttp) {
    return {
      ok: false,
      error: `${label}须为公网图片 URL 或 Data URL（image/…）`,
    };
  }
  return { ok: true };
}

/** HappyHorse 参考生视频（1～9 张 reference_image），异步任务创建 */
export async function r2vCreateReferenceVideoTask(opts: {
  apiKey: string;
  /** DashScope `model`；缺省为 HappyHorse R2V */
  model?: string;
  prompt: string;
  /** 与 media 顺序一致；每项为 HTTPS/HTTP URL 或 data:image/… */
  referenceImageUrls: string[];
  resolution: "720P" | "1080P";
  /** 如 16:9、9:16，见官方文档 */
  ratio: string;
  duration: number;
  seedStr?: string;
  watermark?: boolean;
  parameterExtras?: Record<string, unknown>;
}): Promise<{ ok: true; taskId: string } | { ok: false; error: string }> {
  const prompt = opts.prompt.trim();
  if (!prompt) return { ok: false, error: "提示词不能为空" };

  const urls = opts.referenceImageUrls.map((s) => s.trim()).filter(Boolean);
  if (urls.length < 1 || urls.length > 9) {
    return { ok: false, error: "参考图数量须为 1～9 张" };
  }
  for (let i = 0; i < urls.length; i++) {
    const v = validateImageRef(`参考图 ${i + 1}`, urls[i]!);
    if (!v.ok) return v;
  }

  const duration = Math.min(15, Math.max(3, Math.floor(opts.duration)));
  const seed = parseSeed(opts.seedStr);
  const ratio = opts.ratio.trim() || "16:9";

  const model =
    typeof opts.model === "string" && opts.model.trim()
      ? opts.model.trim()
      : HAPPYHORSE_R2V_MODEL;

  const parameters: Record<string, unknown> = {
    ...(opts.parameterExtras ?? {}),
    resolution: opts.resolution,
    ratio,
    duration,
    watermark: opts.watermark ?? false,
  };
  if (seed != null) parameters.seed = seed;

  const body = {
    model,
    input: {
      prompt,
      media: urls.map((url) => ({ type: "reference_image", url })),
    },
    parameters,
  };

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
    const msg =
      typeof json.message === "string" ? json.message : "接口未返回 task_id";
    return { ok: false, error: msg };
  }
  return { ok: true, taskId };
}

/** Wan 文生视频（无首帧）；duration 仅部分模型支持 5 / 10 */
export async function t2vCreateVideoTask(opts: {
  apiKey: string;
  model: string;
  prompt: string;
  /** 如 1280*720、1920*1080 */
  size: string;
  duration: 5 | 10;
  parameterExtras?: Record<string, unknown>;
}): Promise<{ ok: true; taskId: string } | { ok: false; error: string }> {
  const prompt = opts.prompt.trim();
  if (!prompt) return { ok: false, error: "提示词不能为空" };

  const model = opts.model.trim();
  if (!model) return { ok: false, error: "缺少模型名称" };

  const size = opts.size.trim();
  if (!size) return { ok: false, error: "缺少画面尺寸（size）" };

  const parameters: Record<string, unknown> = {
    ...(opts.parameterExtras ?? {}),
    size,
    duration: opts.duration,
  };

  const body = {
    model,
    input: { prompt },
    parameters,
  };

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
          : `创建文生视频任务失败（HTTP ${res.status}）`,
    };
  }
  const taskId = json.output?.task_id?.trim();
  if (!taskId) {
    const msg =
      typeof json.message === "string" ? json.message : "接口未返回 task_id";
    return { ok: false, error: msg };
  }
  return { ok: true, taskId };
}

export async function i2vGetVideoTask(opts: {
  apiKey: string;
  taskId: string;
}): Promise<
  | { ok: true; output: I2vTaskOutput; raw: unknown }
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
  const output = top?.output as I2vTaskOutput | undefined;

  if (!res.ok || !output) {
    const msg =
      typeof top?.message === "string"
        ? top.message
        : `查询任务失败（HTTP ${res.status}）`;
    return { ok: false, error: msg };
  }

  return { ok: true, output, raw };
}
