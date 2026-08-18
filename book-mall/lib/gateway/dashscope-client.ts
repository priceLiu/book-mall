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
const IMAGE2IMAGE_SYNTHESIS_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis";
const OUT_PAINTING_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/out-painting";
const WANX_CREATE_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis";
const WAN27_IMAGE_CREATE_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation";
const VIDEO_CREATE_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis";
/**
 * 数字人 wan2.2-s2v 创建端点（厂商确认须 image2video，**非** video-generation）。
 * @see https://help.aliyun.com/zh/model-studio/wan-s2v-api
 */
export const S2V_CREATE_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2video/video-synthesis/";
export const S2V_CREATE_PATH = "/api/v1/services/aigc/image2video/video-synthesis/";
/** 形象图预检（同步接口，0.004 元/张），提交 S2V 前先判人像是否合规 */
export const S2V_DETECT_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2video/face-detect/";
export const S2V_DETECT_PATH = "/api/v1/services/aigc/image2video/face-detect/";
const IMAGE_PROCESS_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/vision/image-process/process";
const TASK_URL_BASE = "https://dashscope.aliyuncs.com/api/v1/tasks";

const DASHSCOPE_DEFAULT_ROOT = "https://dashscope.aliyuncs.com";

/** 从凭证 baseUrl 解析 DashScope / 百炼业务空间 API 根域名 */
export function resolveDashscopeApiRoot(baseUrl?: string | null): string {
  let raw = (baseUrl?.trim() || DASHSCOPE_DEFAULT_ROOT).replace(/\/$/, "");
  raw = raw.replace(/\/compatible-mode\/v1$/i, "");
  if (raw.includes("/api/v1/services")) {
    return raw.replace(/\/api\/v1\/services.*$/, "");
  }
  if (raw.includes("/api/v1/tasks")) {
    return raw.replace(/\/api\/v1\/tasks.*$/, "");
  }
  if (/\/api\/v1$/i.test(raw)) {
    return raw.replace(/\/api\/v1$/i, "");
  }
  return raw || DASHSCOPE_DEFAULT_ROOT;
}

/** wan2.2-s2v 固定走厂商确认的 image2video 端点（忽略凭证里误配的 video-generation 路径） */
export function resolveDashscopeS2vCreateUrl(_baseUrl?: string | null): string {
  return S2V_CREATE_URL;
}

export function resolveDashscopeS2vDetectUrl(_baseUrl?: string | null): string {
  return S2V_DETECT_URL;
}

export function resolveDashscopeTaskUrl(
  baseUrl: string | null | undefined,
  taskId: string,
): string {
  return `${resolveDashscopeApiRoot(baseUrl)}/api/v1/tasks/${encodeURIComponent(taskId.trim())}`;
}

/**
 * 从 sk-ws Key 解析业务空间 ID。
 * 格式示例：sk-ws-{prefix}.{workspaceId}.{keyId}.{MEQ…签名}
 * workspaceId 须为单段（*.cn-beijing.maas.aliyuncs.com 通配符不覆盖多级子域）。
 */
export function parseDashscopeWorkspaceIdFromApiKey(apiKey: string): string | null {
  const trimmed = apiKey.trim();
  const structured = trimmed.match(/^sk-ws-[^.]+\.([^.]+)\.[^.]+\.(MEQ[A-Za-z0-9_=-]+)$/i);
  if (structured?.[1]) return structured[1];
  // 部分控制台 Key 尾段签名不一定以 MEQ 开头，仍按 sk-ws-*.{workspaceId}.* 取第二段
  if (trimmed.startsWith("sk-ws-")) {
    const parts = trimmed.split(".");
    if (parts.length >= 3 && parts[1]?.trim()) return parts[1].trim();
  }
  return null;
}

/** sk-ws-{WorkspaceId}.… → 华北2 业务空间根域名 */
export function resolveDashscopeBeijingMaasBaseUrl(apiKey: string): string | null {
  const workspaceId = parseDashscopeWorkspaceIdFromApiKey(apiKey);
  if (!workspaceId) return null;
  return `https://${workspaceId}.cn-beijing.maas.aliyuncs.com`;
}

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
  const pick = (val: unknown): string | undefined =>
    typeof val === "string" && val.trim() ? val.trim() : undefined;

  const direct = pick(output.video_url);
  if (direct) return upgradeAliyunHttpToHttps(direct);

  const results = output.results;
  if (results && typeof results === "object" && !Array.isArray(results)) {
    const nested = results as Record<string, unknown>;
    const fromResults =
      pick(nested.video_url) ?? pick(nested.url) ?? pick(nested.videoUrl);
    if (fromResults) return upgradeAliyunHttpToHttps(fromResults);
  }
  if (Array.isArray(results) && results.length > 0) {
    const first = results[0];
    if (first && typeof first === "object") {
      const row = first as Record<string, unknown>;
      const fromRow = pick(row.video_url) ?? pick(row.url) ?? pick(row.videoUrl);
      if (fromRow) return upgradeAliyunHttpToHttps(fromRow);
    }
  }

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

/** ASR 任务成功但无有效语音片段 · 按空字幕继续剪辑 */
export function isDashscopeAsrNoSpeechOutcome(
  status: string | undefined,
  code?: string | null,
  message?: string | null,
): boolean {
  const blob = `${status ?? ""} ${code ?? ""} ${message ?? ""}`.toUpperCase();
  return (
    blob.includes("NO_VALID_FRAGMENT") ||
    blob.includes("NO_SPEECH") ||
    blob.includes("NO_VALID_AUDIO")
  );
}

export async function dashscopeGetTask(opts: {
  apiKey: string;
  taskId: string;
  baseUrl?: string | null;
}): Promise<{ ok: true; output: DashscopeTaskOutput; raw: unknown } | { ok: false; error: string }> {
  const taskId = opts.taskId.trim();
  if (!taskId) return { ok: false, error: "缺少 task_id" };

  let res: Response;
  try {
    res = await fetch(resolveDashscopeTaskUrl(opts.baseUrl, taskId), {
      headers: { Authorization: `Bearer ${opts.apiKey}` },
      cache: "no-store",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error:
        msg === "fetch failed"
          ? "DashScope 任务查询网络异常，请稍后重试"
          : `DashScope 任务查询失败：${msg}`,
    };
  }
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

  let res: Response;
  try {
    res = await fetch(WAN27_IMAGE_CREATE_URL, {
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error:
        msg === "fetch failed"
          ? "DashScope 生图请求网络异常，请检查网络后重试"
          : `DashScope 生图请求失败：${msg}`,
    };
  }

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

/**
 * 数字人对口型（wan2.2-s2v）：形象图 + 人声音频 → 口播视频。
 * 端点与普通 T2V/I2V 不同（image2video/video-synthesis），厂商同时处理中任务数为 **1**。
 *
 * @see https://help.aliyun.com/zh/model-studio/wan-s2v-api
 */
export async function dashscopeCreateS2vTask(opts: {
  apiKey: string;
  baseUrl?: string | null;
  model?: string;
  imageUrl: string;
  audioUrl: string;
  resolution?: "480P" | "720P";
}): Promise<{ ok: true; taskId: string } | { ok: false; error: string }> {
  const imageUrl = opts.imageUrl.trim();
  const audioUrl = opts.audioUrl.trim();
  if (!imageUrl) return { ok: false, error: "image_url 不能为空" };
  if (!audioUrl) return { ok: false, error: "audio_url 不能为空" };

  const res = await fetch(resolveDashscopeS2vCreateUrl(opts.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model: opts.model?.trim() || "wan2.2-s2v",
      input: { image_url: imageUrl, audio_url: audioUrl },
      parameters: { resolution: opts.resolution ?? "480P" },
    }),
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      error:
        typeof json.message === "string"
          ? json.message
          : `创建数字人任务失败（HTTP ${res.status}）`,
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

export type S2vDetectResult = {
  checkPass: boolean;
  humanoid: boolean | null;
  message: string | null;
  requestId: string | null;
};

/**
 * 数字人形象图预检（wan2.2-s2v-detect，同步）。
 * 无论是否通过、只要请求成功即计费；用于拦住不合格人像，避免 S2V 长时间排队后失败。
 *
 * @see https://help.aliyun.com/zh/model-studio/wan-s2v-detect-api
 */
export async function dashscopeDetectS2vImage(opts: {
  apiKey: string;
  baseUrl?: string | null;
  model?: string;
  imageUrl: string;
}): Promise<{ ok: true; result: S2vDetectResult } | { ok: false; error: string }> {
  const imageUrl = opts.imageUrl.trim();
  if (!imageUrl) return { ok: false, error: "image_url 不能为空" };

  const res = await fetch(resolveDashscopeS2vDetectUrl(opts.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model?.trim() || "wan2.2-s2v-detect",
      input: { image_url: imageUrl },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      error:
        typeof json.message === "string"
          ? json.message
          : `形象图检测失败（HTTP ${res.status}）`,
    };
  }

  const output = (json.output ?? {}) as {
    check_pass?: boolean;
    humanoid?: boolean;
    message?: string;
  };
  if (typeof output.check_pass !== "boolean") {
    return { ok: false, error: "检测接口未返回 check_pass" };
  }
  return {
    ok: true,
    result: {
      checkPass: output.check_pass,
      humanoid: typeof output.humanoid === "boolean" ? output.humanoid : null,
      message: output.message?.trim() || null,
      requestId:
        typeof json.request_id === "string" ? json.request_id : null,
    },
  };
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

export function dashscopeExtractAllTaskImageUrls(
  output: Record<string, unknown>,
): string[] {
  const urls: string[] = [];
  const single = dashscopeExtractTaskImageUrl(output);
  if (single) urls.push(single);
  const results = output.results;
  if (Array.isArray(results)) {
    for (const item of results) {
      if (!item || typeof item !== "object") continue;
      const r = item as Record<string, unknown>;
      const u =
        typeof r.url === "string"
          ? r.url.trim()
          : typeof r.image_url === "string"
            ? r.image_url.trim()
            : "";
      if (u) urls.push(upgradeAliyunHttpToHttps(u));
    }
  }
  return [...new Set(urls)];
}

async function dashscopeCreateAsyncTask(opts: {
  apiKey: string;
  url: string;
  body: Record<string, unknown>;
}): Promise<{ ok: true; taskId: string } | { ok: false; error: string }> {
  const res = await fetch(opts.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify(opts.body),
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

export async function dashscopeCreateOutPaintingTask(opts: {
  apiKey: string;
  imageUrl: string;
  parameters?: Record<string, unknown>;
}): Promise<{ ok: true; taskId: string } | { ok: false; error: string }> {
  const imageUrl = opts.imageUrl.trim();
  if (!imageUrl) return { ok: false, error: "image_url 不能为空" };
  return dashscopeCreateAsyncTask({
    apiKey: opts.apiKey,
    url: OUT_PAINTING_URL,
    body: {
      model: "image-out-painting",
      input: { image_url: imageUrl },
      parameters: opts.parameters ?? {},
    },
  });
}

export async function dashscopeCreateImage2ImageTask(opts: {
  apiKey: string;
  model: string;
  input: Record<string, unknown>;
  parameters?: Record<string, unknown>;
}): Promise<{ ok: true; taskId: string } | { ok: false; error: string }> {
  const model = opts.model.trim();
  if (!model) return { ok: false, error: "model 不能为空" };
  return dashscopeCreateAsyncTask({
    apiKey: opts.apiKey,
    url: IMAGE2IMAGE_SYNTHESIS_URL,
    body: {
      model,
      input: opts.input,
      parameters: opts.parameters ?? {},
    },
  });
}

export const QWEN3_ASR_FLASH_FILETRANS_MODEL = "qwen3-asr-flash-filetrans";

const ASR_TRANSCRIPTION_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription";

export type DashscopeAsrSentence = {
  beginMs: number;
  endMs: number;
  text: string;
};

function parseAsrSentencesFromTranscriptionJson(
  raw: unknown,
): DashscopeAsrSentence[] {
  const root = raw as Record<string, unknown> | null;
  const transcripts = root?.transcripts;
  if (!Array.isArray(transcripts) || transcripts.length === 0) return [];
  const first = transcripts[0] as Record<string, unknown>;
  const sentences = first?.sentences;
  const out: DashscopeAsrSentence[] = [];
  if (Array.isArray(sentences)) {
    for (const s of sentences) {
      if (!s || typeof s !== "object") continue;
      const row = s as Record<string, unknown>;
      const text = typeof row.text === "string" ? row.text.trim() : "";
      if (!text) continue;
      const beginMs =
        typeof row.begin_time === "number"
          ? row.begin_time
          : Number(row.begin_time);
      const endMs =
        typeof row.end_time === "number" ? row.end_time : Number(row.end_time);
      if (!Number.isFinite(beginMs) || !Number.isFinite(endMs)) continue;
      out.push({ beginMs, endMs, text });
    }
  }
  // 无句级时间戳时退回整段 text，由下游按字数切短 cue
  if (out.length === 0) {
    const text = typeof first?.text === "string" ? first.text.trim() : "";
    if (text) {
      const props = first?.audio_info as Record<string, unknown> | undefined;
      const durationMs = Number(
        props?.original_duration_in_milliseconds ??
          first?.content_duration_in_milliseconds ??
          0,
      );
      out.push({
        beginMs: 0,
        endMs: Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 3000,
        text,
      });
    }
  }
  return out;
}

export async function dashscopeCreateAsrFiletransTask(opts: {
  apiKey: string;
  fileUrl: string;
  model?: string;
  enableWords?: boolean;
}): Promise<{ ok: true; taskId: string } | { ok: false; error: string }> {
  const fileUrl = opts.fileUrl.trim();
  if (!fileUrl) return { ok: false, error: "file_url 不能为空" };
  const model = opts.model?.trim() || QWEN3_ASR_FLASH_FILETRANS_MODEL;
  return dashscopeCreateAsyncTask({
    apiKey: opts.apiKey,
    url: ASR_TRANSCRIPTION_URL,
    body: {
      model,
      input: { file_url: fileUrl },
      parameters: {
        channel_id: [0],
        enable_itn: false,
        enable_words: opts.enableWords ?? false,
      },
    },
  });
}

export async function dashscopeFetchAsrTranscriptionSentences(opts: {
  apiKey: string;
  taskId: string;
  pollIntervalMs?: number;
  maxWaitMs?: number;
}): Promise<
  | { ok: true; sentences: DashscopeAsrSentence[] }
  | { ok: false; error: string }
> {
  const pollIntervalMs = opts.pollIntervalMs ?? 2000;
  const maxWaitMs = opts.maxWaitMs ?? 180_000;
  const started = Date.now();

  while (Date.now() - started < maxWaitMs) {
    const task = await dashscopeGetTask({
      apiKey: opts.apiKey,
      taskId: opts.taskId,
    });
    if (!task.ok) return { ok: false, error: task.error };

    const status = task.output.task_status;
    if (isDashscopeAsrNoSpeechOutcome(status, task.output.code, task.output.message)) {
      return { ok: true, sentences: [] };
    }
    if (isDashscopeTaskFailed(status)) {
      const msg =
        task.output.message?.trim() ||
        task.output.code?.trim() ||
        "ASR 任务失败";
      if (isDashscopeAsrNoSpeechOutcome(status, task.output.code, msg)) {
        return { ok: true, sentences: [] };
      }
      return { ok: false, error: msg };
    }

    if (!isDashscopeTaskSuccess(status)) {
      await new Promise((r) => setTimeout(r, pollIntervalMs));
      continue;
    }

    const output = task.raw as Record<string, unknown> | null;
    const outObj = output?.output as Record<string, unknown> | undefined;
    const result = outObj?.result as Record<string, unknown> | undefined;
    const transcriptionUrl =
      typeof result?.transcription_url === "string"
        ? result.transcription_url.trim()
        : "";
    if (!transcriptionUrl) {
      return { ok: true, sentences: [] };
    }

    let res: Response;
    try {
      res = await fetch(transcriptionUrl, { cache: "no-store" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: `下载 ASR 结果失败：${msg}` };
    }
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        ok: false,
        error: `下载 ASR 结果 HTTP ${res.status}`,
      };
    }
    return {
      ok: true,
      sentences: parseAsrSentencesFromTranscriptionJson(json),
    };
  }

  return { ok: false, error: "ASR 任务轮询超时" };
}

export async function dashscopeTranscribePublicFileUrl(opts: {
  apiKey: string;
  fileUrl: string;
  model?: string;
}): Promise<
  | { ok: true; sentences: DashscopeAsrSentence[] }
  | { ok: false; error: string }
> {
  const created = await dashscopeCreateAsrFiletransTask(opts);
  if (!created.ok) return created;
  return dashscopeFetchAsrTranscriptionSentences({
    apiKey: opts.apiKey,
    taskId: created.taskId,
  });
}
