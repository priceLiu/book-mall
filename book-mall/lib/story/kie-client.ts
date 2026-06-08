/**
 * KIE.AI 客户端：createTask（提交）+ recordInfo（查询）。
 * 详见 story-web/docs/kie/nano-banna-pro.md / Wan 2.7 Image Pro.md / get-kie-task.md
 *
 * 错误处理：仅抛 KieError；调用方根据 retryable 决定重试或 markFailed。
 */
import { maskTokenInUrl } from "./story-ai-constants";

export type KieAspectRatio = "16:9" | "9:16" | "1:1";

export type KieImageInput = {
  prompt: string;
  image_input?: string[];
  aspect_ratio?: KieAspectRatio;
  resolution?: "1K" | "2K";
  output_format?: "png" | "jpeg" | "webp";
};

/** Seedance 2 视频生成入参（替代之前的 Wan 2.7 入参） */
export type KieVideoInput = {
  prompt: string;
  /** 图生视频参考图（首帧/角色等），最多 9 张 */
  reference_image_urls?: string[];
  /** 视频参考（可选） */
  reference_video_urls?: string[];
  /** 音频参考（可选） */
  reference_audio_urls?: string[];
  /** 是否生成音频，默认 true；分镜场景一般不需要 */
  generate_audio?: boolean;
  aspect_ratio?: "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9";
  resolution?: "480p" | "720p" | "1080p";
  /** 视频时长（秒），4~15，默认 15 */
  duration?: number;
};

export type KieRecordState = "waiting" | "queuing" | "generating" | "success" | "fail";

export type KieRecordResponse = {
  taskId: string;
  model: string;
  state: KieRecordState;
  param?: string;
  resultJson?: string;
  failCode?: string;
  failMsg?: string;
  costTime?: number;
  completeTime?: number | null;
};

export class KieError extends Error {
  constructor(
    public code:
      | "KIE_NOT_CONFIGURED"
      | "KIE_HTTP_ERROR"
      | "KIE_QUOTA_EXCEEDED"
      | "KIE_TASK_NOT_FOUND"
      | "KIE_INVALID_RESPONSE",
    message: string,
    public httpStatus: number = 502,
    public retryable: boolean = true,
  ) {
    super(message);
    this.name = "KieError";
  }
}

function kieQuotaExceededMessage(_raw?: string): string {
  return "KIE 余额不足，请登录 kie.ai 充值后重试";
}

/** 写入任务 failMessage 前统一友好化（story / canvas 共用） */
export function formatKieTaskFailMessage(
  failCode?: string | null,
  failMessage?: string | null,
): string {
  const msg = (failMessage ?? "").trim();
  const code = (failCode ?? "").trim();
  const blob = `${code} ${msg}`.toLowerCase();
  if (
    code === "KIE_QUOTA_EXCEEDED" ||
    blob.includes("code=402") ||
    blob.includes("credits insufficient") ||
    blob.includes("insufficient credit") ||
    blob.includes("余额不足")
  ) {
    return kieQuotaExceededMessage(msg);
  }
  return msg || code || "生成失败";
}

function getBase(): string {
  return (process.env.KIE_API_BASE?.trim() || "https://api.kie.ai").replace(/\/$/, "");
}

export type CreateKieTaskArgs = {
  model: string;
  input: KieImageInput | KieVideoInput;
  /** 可空 —— 本地开发时不下发，纯靠 poll worker（决议 §13.6） */
  callBackUrl?: string | null;
};

async function createKieTaskWithApiKey(
  apiKey: string,
  base: string,
  args: CreateKieTaskArgs,
): Promise<{ taskId: string }> {
  const url = `${base.replace(/\/$/, "")}/api/v1/jobs/createTask`;
  const body: Record<string, unknown> = { model: args.model, input: args.input };
  if (args.callBackUrl) body.callBackUrl = args.callBackUrl;

  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON */
  }
  if (!r.ok) {
    if (r.status === 402 || /quota|insufficient|credit|balance/i.test(text)) {
      throw new KieError(
        "KIE_QUOTA_EXCEEDED",
        kieQuotaExceededMessage(text),
        402,
        false,
      );
    }
    throw new KieError(
      "KIE_HTTP_ERROR",
      `createTask HTTP ${r.status}: ${text.slice(0, 400)}`,
      r.status >= 400 && r.status < 600 ? r.status : 502,
    );
  }
  const code = (json as { code?: number })?.code;
  if (code !== 200) {
    const msg = String((json as { msg?: string })?.msg ?? text);
    if (code === 402 || /quota|insufficient|credit|balance/i.test(msg)) {
      throw new KieError(
        "KIE_QUOTA_EXCEEDED",
        kieQuotaExceededMessage(msg),
        402,
        false,
      );
    }
    const httpStatus =
      typeof code === "number" && code >= 400 && code < 600 ? code : 502;
    throw new KieError(
      "KIE_HTTP_ERROR",
      `createTask code=${code} msg=${msg}`,
      httpStatus,
      code !== 402,
    );
  }
  const taskId = (json as { data?: { taskId?: string } })?.data?.taskId;
  if (!taskId || typeof taskId !== "string") {
    throw new KieError(
      "KIE_INVALID_RESPONSE",
      `createTask missing data.taskId: ${text.slice(0, 200)}`,
      502,
      false,
    );
  }
  return { taskId };
}

export async function createKieTaskWithKey(
  apiKey: string,
  args: CreateKieTaskArgs,
  baseUrl?: string,
): Promise<{ taskId: string }> {
  const base = baseUrl?.trim() || getBase();
  return createKieTaskWithApiKey(apiKey, base, args);
}

async function getKieTaskWithApiKey(
  apiKey: string,
  base: string,
  taskId: string,
): Promise<KieRecordResponse> {
  const url = `${base.replace(/\/$/, "")}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`;
  const r = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const text = await r.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON */
  }
  if (!r.ok) {
    if (r.status === 404) {
      throw new KieError(
        "KIE_TASK_NOT_FOUND",
        `taskId ${taskId} not found`,
        404,
        false,
      );
    }
    throw new KieError(
      "KIE_HTTP_ERROR",
      `recordInfo HTTP ${r.status}: ${text.slice(0, 400)}`,
      502,
    );
  }
  const code = (json as { code?: number })?.code;
  if (code !== 200) {
    const msg = (json as { msg?: string })?.msg ?? text;
    throw new KieError(
      "KIE_HTTP_ERROR",
      `recordInfo code=${code} msg=${msg}`,
      502,
    );
  }
  const data = (json as { data?: KieRecordResponse }).data;
  if (!data || !data.taskId) {
    throw new KieError(
      "KIE_INVALID_RESPONSE",
      "recordInfo missing data",
      502,
      false,
    );
  }
  return data;
}

export async function getKieTaskWithKey(
  apiKey: string,
  taskId: string,
  baseUrl?: string,
): Promise<KieRecordResponse> {
  const base = baseUrl?.trim() || getBase();
  return getKieTaskWithApiKey(apiKey, base, taskId);
}

/**
 * 解析 resultJson 中的第一个 resultUrl（对成功任务可用）。
 * 失败任务请走 failCode/failMsg。
 */
export function extractKieResultUrl(record: KieRecordResponse): string | null {
  if (!record.resultJson) return null;
  try {
    let parsed: unknown = JSON.parse(record.resultJson);
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        /* keep string */
      }
    }
    if (typeof parsed === "string" && /^https?:\/\//i.test(parsed)) {
      return parsed;
    }
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      const urls = obj.resultUrls;
      if (Array.isArray(urls)) {
        const first = urls.find((u) => typeof u === "string" && u);
        if (typeof first === "string") return first;
      }
      for (const key of ["url", "imageUrl", "videoUrl", "output"]) {
        const v = obj[key];
        if (typeof v === "string" && /^https?:\/\//i.test(v)) return v;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function isKieRecordSuccess(state: string | undefined | null): boolean {
  return (state ?? "").trim().toLowerCase() === "success";
}

export function isKieRecordFail(state: string | undefined | null): boolean {
  return (state ?? "").trim().toLowerCase() === "fail";
}

export function logKieEvent(
  level: "info" | "warn" | "error",
  message: string,
  meta?: Record<string, unknown>,
): void {
  const safeMeta = meta
    ? Object.fromEntries(
        Object.entries(meta).map(([k, v]) =>
          typeof v === "string" && /token=/.test(v)
            ? [k, maskTokenInUrl(v)]
            : [k, v],
        ),
      )
    : undefined;
  // eslint-disable-next-line no-console
  console[level](`[story-kie] ${message}`, safeMeta ?? "");
}
