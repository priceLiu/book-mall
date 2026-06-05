/**
 * 阿里云 DashScope 异步任务 HTTP 客户端（试衣 / 文生图 / 视频合成 / 任务轮询）
 * 自 tool-web 上移至 book-mall，供 Gateway 与 tool-gateway-client 共用。
 */

export const WANX_TEXT2IMAGE_PLUS_MODEL = "wanx2.1-t2i-plus";
/** 支持 content 多图 + text 参考生成（分镜垫图） */
export const WAN27_IMAGE_MODEL = "wan2.7-image";
/** 万相 2.6 图像编辑 / 多图参考（非 t2i） */
export const WAN26_IMAGE_MODEL = "wan2.6-image";
/** 可灵 3.0 Omni · 多图参考生分镜（百炼 DashScope） */
export const KLING_V3_OMNI_IMAGE_MODEL = "kling/kling-v3-omni-image-generation";

const TRYON_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis/";
const WANX_CREATE_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis";
const WAN27_IMAGE_CREATE_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation";
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

  const choices = output.choices;
  if (Array.isArray(choices)) {
    for (const choice of choices) {
      if (!choice || typeof choice !== "object") continue;
      const msg = (choice as Record<string, unknown>).message;
      if (!msg || typeof msg !== "object") continue;
      const content = (msg as Record<string, unknown>).content;
      if (!Array.isArray(content)) continue;
      for (const item of content) {
        if (!item || typeof item !== "object") continue;
        const img = pick((item as Record<string, unknown>).image);
        if (img) return upgradeAliyunHttpToHttps(img);
      }
    }
  }

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
  size?: string;
  /** 垫图 URL（产品图等） */
  refImg?: string;
  refMode?: "repaint" | "refonly";
  refStrength?: number;
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
        ...(opts.refImg?.trim() && /^https?:\/\//.test(opts.refImg.trim())
          ? { ref_img: opts.refImg.trim() }
          : {}),
      },
      parameters: {
        size: opts.size?.trim() || "1024*1024",
        n,
        prompt_extend: true,
        watermark: false,
        ...(opts.refImg?.trim()
          ? {
              ref_mode: opts.refMode ?? "repaint",
              ref_strength:
                typeof opts.refStrength === "number"
                  ? Math.max(0, Math.min(1, opts.refStrength))
                  : 0.85,
            }
          : {}),
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

export type Wan27ImageContentItem = { text: string } | { image: string };

function orderWanImageContent(
  items: Wan27ImageContentItem[],
  order: "text-first" | "images-first",
): Wan27ImageContentItem[] {
  const texts = items.filter((c) => "text" in c && c.text.trim());
  const images = items.filter(
    (c) => "image" in c && /^https?:\/\//.test(c.image.trim()),
  );
  return order === "text-first" ? [...texts, ...images] : [...images, ...texts];
}

/** 万相 2.7 / 2.6-image 多图参考（messages 协议） */
export async function dashscopeCreateWan27ImageTask(opts: {
  apiKey: string;
  model?: string;
  content: Wan27ImageContentItem[];
  size?: string;
  n?: number;
  /** wan2.6-image 要求 text 在前；wan2.7 为 images 在前 */
  contentOrder?: "text-first" | "images-first";
}): Promise<{ ok: true; taskId: string } | { ok: false; error: string }> {
  const items = opts.content.filter(
    (c) =>
      ("text" in c && c.text.trim()) ||
      ("image" in c && /^https?:\/\//.test(c.image.trim())),
  );
  const hasText = items.some((c) => "text" in c);
  if (!hasText) return { ok: false, error: "缺少 text 提示词" };

  const model = opts.model?.trim() || WAN27_IMAGE_MODEL;
  const isWan26Image = model.toLowerCase().includes("wan2.6-image");
  if (!isWan26Image && items.length < 2) {
    return { ok: false, error: "缺少有效输入" };
  }

  const contentOrder =
    opts.contentOrder ?? (isWan26Image ? "text-first" : "images-first");
  const ordered = orderWanImageContent(items, contentOrder);
  const n = Math.min(isWan26Image ? 9 : 4, Math.max(1, Math.floor(opts.n ?? 1)));

  const parameters: Record<string, unknown> = isWan26Image
    ? {
        prompt_extend: true,
        watermark: false,
        n,
        enable_interleave: false,
        size: opts.size?.trim() || "2K",
      }
    : {
        size: opts.size?.trim() || "2K",
        n,
        watermark: false,
      };

  const res = await fetch(WAN27_IMAGE_CREATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model,
      input: {
        messages: [
          {
            role: "user",
            content: ordered.map((c) =>
              "text" in c ? { text: c.text.trim() } : { image: c.image.trim() },
            ),
          },
        ],
      },
      parameters,
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

/** 可灵 3.0 图像生成（messages 多图 + text，与万相 2.7 同端点） */
export async function dashscopeCreateKlingV3ImageTask(opts: {
  apiKey: string;
  model?: string;
  content: Wan27ImageContentItem[];
  aspectRatio?: "16:9" | "9:16" | "1:1";
  resolution?: "1k" | "2k" | "4k";
  n?: number;
}): Promise<{ ok: true; taskId: string } | { ok: false; error: string }> {
  const items = opts.content.filter(
    (c) =>
      ("text" in c && c.text.trim()) ||
      ("image" in c && /^https?:\/\//.test(c.image.trim())),
  );
  const hasText = items.some((c) => "text" in c);
  if (!hasText) return { ok: false, error: "缺少 text 提示词" };
  if (items.length < 1) return { ok: false, error: "缺少有效输入" };

  const model = opts.model?.trim() || KLING_V3_OMNI_IMAGE_MODEL;
  const n = Math.min(9, Math.max(1, Math.floor(opts.n ?? 1)));
  const resolution = opts.resolution ?? "2k";

  const res = await fetch(WAN27_IMAGE_CREATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model,
      input: {
        messages: [
          {
            role: "user",
            content: items.map((c) =>
              "text" in c ? { text: c.text.trim() } : { image: c.image.trim() },
            ),
          },
        ],
      },
      parameters: {
        n,
        aspect_ratio: opts.aspectRatio ?? "9:16",
        resolution,
        watermark: false,
        result_type: "single",
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
