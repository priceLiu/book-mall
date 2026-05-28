/**
 * 阿里云 DashScope 异步任务 HTTP 客户端（试衣 / 文生图 / 视频合成 / 任务轮询）
 * 自 tool-web 上移至 book-mall，供 Gateway 与 tool-gateway-client 共用。
 */

export const WANX_TEXT2IMAGE_PLUS_MODEL = "wanx2.1-t2i-plus";

const TRYON_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis/";
const WANX_CREATE_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis";
const VIDEO_CREATE_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis";
const IMAGE_PROCESS_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/vision/image-process/process";
const TASK_URL_BASE = "https://dashscope.aliyuncs.com/api/v1/tasks";

export const AITRYON_PARSING_MODEL = "aitryon-parsing-v1";

export type DashscopeClothesType = "upper" | "lower" | "dress";

export type DashscopeParsingOutput = {
  parsing_img_url?: (string | null)[];
  crop_img_url?: (string | null)[];
  bbox?: (number[] | null)[] | null;
};

export type DashscopeTaskOutput = {
  task_id?: string;
  task_status?: string;
  submit_time?: string;
  scheduled_time?: string;
  end_time?: string;
  video_url?: string;
  image_url?: string;
  results?: Array<{ url?: string; image_url?: string }>;
  task_metrics?: { TOTAL?: number; SUCCEEDED?: number; FAILED?: number };
  code?: string;
  message?: string;
};

function upgradeAliyunHttpToHttps(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    if (u.protocol === "http:" && /\.aliyuncs\.com$/i.test(u.hostname)) {
      u.protocol = "https:";
      return u.toString();
    }
  } catch {
    /* ignore */
  }
  return rawUrl;
}

export function dashscopeExtractTaskImageUrl(
  output: Record<string, unknown>,
): string | undefined {
  const pick = (val: unknown): string | undefined =>
    typeof val === "string" && val.trim() ? val.trim() : undefined;

  const direct = pick(output.image_url);
  if (direct) return upgradeAliyunHttpToHttps(direct);

  const results = output.results;
  if (Array.isArray(results) && results.length > 0) {
    const first = results[0];
    const fromStr = pick(first);
    if (fromStr) return upgradeAliyunHttpToHttps(fromStr);
    if (first && typeof first === "object") {
      const r = first as Record<string, unknown>;
      const u = pick(r.url) ?? pick(r.image_url);
      if (u) return upgradeAliyunHttpToHttps(u);
    }
  }

  const oiu = pick(output.output_image_url);
  if (oiu) return upgradeAliyunHttpToHttps(oiu);
  return undefined;
}

export function dashscopeExtractTaskVideoUrl(
  output: Record<string, unknown>,
): string | undefined {
  const v = output.video_url;
  if (typeof v === "string" && v.trim()) return upgradeAliyunHttpToHttps(v.trim());
  return undefined;
}

export function isDashscopeTaskSuccess(status: string | undefined): boolean {
  const s = (status ?? "").toUpperCase();
  return s === "SUCCEEDED" || s === "SUCCESS";
}

export function isDashscopeTaskFailed(status: string | undefined): boolean {
  const s = (status ?? "").toUpperCase();
  return s === "FAILED" || s === "CANCELED" || s === "UNKNOWN";
}

export async function dashscopeGetTask(opts: {
  apiKey: string;
  taskId: string;
}): Promise<{ ok: true; output: DashscopeTaskOutput; raw: unknown } | { ok: false; error: string }> {
  const taskId = opts.taskId.trim();
  if (!taskId) return { ok: false, error: "缺少 task_id" };

  const res = await fetch(`${TASK_URL_BASE}/${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${opts.apiKey}` },
    cache: "no-store",
  });
  const raw = await res.json().catch(() => null);
  const top = raw as Record<string, unknown> | null;
  const output = top?.output as DashscopeTaskOutput | undefined;

  if (!res.ok || !output) {
    const msg =
      typeof top?.message === "string"
        ? top.message
        : `查询任务失败（HTTP ${res.status}）`;
    return { ok: false, error: msg };
  }
  return { ok: true, output, raw };
}

export async function dashscopeCreateTryOnTask(opts: {
  apiKey: string;
  personImageUrl: string;
  topGarmentUrl?: string;
  bottomGarmentUrl?: string;
  model?: string;
}): Promise<{ ok: true; taskId: string } | { ok: false; error: string }> {
  const model = opts.model ?? "aitryon";
  const input: Record<string, string> = {
    person_image_url: opts.personImageUrl,
  };
  if (opts.topGarmentUrl) input.top_garment_url = opts.topGarmentUrl;
  if (opts.bottomGarmentUrl) input.bottom_garment_url = opts.bottomGarmentUrl;

  const res = await fetch(TRYON_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model,
      input,
      parameters: { resolution: -1, restore_face: true },
    }),
  });

  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      typeof json.message === "string"
        ? json.message
        : typeof json.code === "string"
          ? json.code
          : `HTTP ${res.status}`;
    return { ok: false, error: msg };
  }
  const output = json.output as Record<string, unknown> | undefined;
  const taskId =
    typeof output?.task_id === "string" ? output.task_id : undefined;
  if (!taskId) return { ok: false, error: "未返回 task_id" };
  return { ok: true, taskId };
}

export async function dashscopeCreateWanxTask(opts: {
  apiKey: string;
  prompt: string;
  negativePrompt?: string;
  n: number;
  model?: string;
}): Promise<{ ok: true; taskId: string } | { ok: false; error: string }> {
  const prompt = opts.prompt.trim();
  if (!prompt) return { ok: false, error: "prompt 不能为空" };
  const n = Math.min(4, Math.max(1, Math.floor(opts.n)));
  const model = opts.model?.trim() || WANX_TEXT2IMAGE_PLUS_MODEL;

  const res = await fetch(WANX_CREATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model,
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

  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      error:
        typeof json.message === "string"
          ? json.message
          : `创建任务失败（HTTP ${res.status}）`,
    };
  }
  const output = json.output as { task_id?: string } | undefined;
  const taskId = output?.task_id?.trim();
  if (!taskId) {
    return {
      ok: false,
      error:
        typeof json.message === "string" ? json.message : "接口未返回 task_id",
    };
  }
  return { ok: true, taskId };
}

export async function dashscopeCreateVideoTask(opts: {
  apiKey: string;
  model: string;
  body: Record<string, unknown>;
}): Promise<{ ok: true; taskId: string } | { ok: false; error: string }> {
  const res = await fetch(VIDEO_CREATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({ model: opts.model, ...opts.body }),
  });

  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      error:
        typeof json.message === "string"
          ? json.message
          : `创建视频任务失败（HTTP ${res.status}）`,
    };
  }
  const output = json.output as { task_id?: string } | undefined;
  const taskId = output?.task_id?.trim();
  if (!taskId) {
    return {
      ok: false,
      error:
        typeof json.message === "string" ? json.message : "接口未返回 task_id",
    };
  }
  return { ok: true, taskId };
}

function pickParsingUrlList(raw: unknown): (string | null)[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.map((item) => {
    if (item == null) return null;
    if (typeof item === "string" && item.trim()) {
      return upgradeAliyunHttpToHttps(item.trim());
    }
    return null;
  });
}

/** AI 试衣 · 图片分割（同步） */
export async function dashscopeImageParsing(opts: {
  apiKey: string;
  imageUrl: string;
  clothesType?: DashscopeClothesType[];
  model?: string;
}): Promise<
  | { ok: true; output: DashscopeParsingOutput; requestId?: string }
  | { ok: false; error: string }
> {
  const imageUrl = upgradeAliyunHttpToHttps(opts.imageUrl.trim());
  if (!/^https:\/\//.test(imageUrl)) {
    return { ok: false, error: "image_url 须为 https 公网地址" };
  }
  const clothesType = opts.clothesType?.length
    ? opts.clothesType
    : (["upper", "lower"] as DashscopeClothesType[]);
  const model = opts.model?.trim() || AITRYON_PARSING_MODEL;

  const res = await fetch(IMAGE_PROCESS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: { image_url: imageUrl },
      parameters: { clothes_type: clothesType },
    }),
  });

  const json = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!res.ok || !json) {
    const msg =
      typeof json?.message === "string"
        ? json.message
        : typeof json?.code === "string"
          ? json.code
          : `分割失败（HTTP ${res.status}）`;
    return { ok: false, error: msg };
  }

  const output = json.output as Record<string, unknown> | undefined;
  if (!output) {
    return { ok: false, error: "分割接口未返回 output" };
  }

  return {
    ok: true,
    output: {
      parsing_img_url: pickParsingUrlList(output.parsing_img_url),
      crop_img_url: pickParsingUrlList(output.crop_img_url),
      bbox: Array.isArray(output.bbox)
        ? (output.bbox as (number[] | null)[])
        : undefined,
    },
    requestId:
      typeof json.request_id === "string" ? json.request_id : undefined,
  };
}

export function countWanxSucceededImages(output: DashscopeTaskOutput): number {
  const urls =
    output.results?.map((r) => r.url).filter((u) => typeof u === "string" && u.trim()) ?? [];
  if (urls.length > 0) return urls.length;
  const t = output.task_metrics?.SUCCEEDED;
  if (typeof t === "number" && t > 0) return Math.min(4, t);
  return 1;
}
