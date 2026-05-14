/**
 * 从 DashScope GET /tasks/{id} 的完整 JSON 中抽取方案 A 视频计费上下文（以 usage 为先，缺字段时可用客户端 billingHint 兜底）。
 */
function readString(o: unknown, ...keys: string[]): string | undefined {
  if (!o || typeof o !== "object") return undefined;
  const r = o as Record<string, unknown>;
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function readNumber(o: unknown, ...keys: string[]): number | undefined {
  if (!o || typeof o !== "object") return undefined;
  const r = o as Record<string, unknown>;
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return undefined;
}

function readBool(o: unknown, key: string): boolean | undefined {
  if (!o || typeof o !== "object") return undefined;
  const v = (o as Record<string, unknown>)[key];
  if (typeof v === "boolean") return v;
  return undefined;
}

function findModelKeyDeep(obj: unknown, depth = 0): string | undefined {
  if (depth > 12 || obj == null || typeof obj !== "object") return undefined;
  const r = obj as Record<string, unknown>;
  for (const [k, v] of Object.entries(r)) {
    if (k === "model" && typeof v === "string" && v.trim()) return v.trim();
    const nested = findModelKeyDeep(v, depth + 1);
    if (nested) return nested;
  }
  return undefined;
}

/** 顶层 / input / output / task 常见字段上的 model */
export function extractDashScopeTaskModel(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const top = raw as Record<string, unknown>;

  const fromTop = readString(top, "model", "model_name", "modelName", "task_model");
  if (fromTop) return fromTop;

  const input = top.input;
  if (input && typeof input === "object") {
    const m = readString(input, "model", "model_name", "modelName");
    if (m) return m;
  }

  const output = top.output;
  if (output && typeof output === "object") {
    const o = output as Record<string, unknown>;
    const m = readString(o, "model", "model_name", "modelName");
    if (m) return m;
    const outInput = o.input;
    if (outInput && typeof outInput === "object") {
      const m2 = readString(outInput, "model", "model_name", "modelName");
      if (m2) return m2;
    }
  }

  for (const k of ["task_params", "parameters", "request", "task"]) {
    const blob = top[k];
    if (blob && typeof blob === "object") {
      const m = readString(blob, "model", "model_name", "modelName");
      if (m) return m;
    }
  }

  const fromDeep = findModelKeyDeep(top);
  if (fromDeep) return fromDeep;

  return undefined;
}

export type VideoTaskBillingContext = {
  apiModel: string;
  durationSec: number;
  sr: number;
  audio: boolean;
};

/** 客户端在创建任务时知的上下文；任务 JSON 偶发缺字段时由 settle 一并提交（时长/分辨率仍以 usage 为准）。 */
export type VideoBillingHint = {
  apiModel?: string;
  durationSec?: number;
  sr?: number;
  /** 与实验室 resolution 一致，如 720P / 1080P */
  resolution?: string;
  audio?: boolean;
};

export function resolutionHintToSr(res: unknown): number | undefined {
  if (typeof res !== "string") return undefined;
  const u = res.trim().toUpperCase();
  if (u === "720P" || u === "720") return 720;
  if (u === "480P" || u === "480") return 480;
  if (u === "1080P" || u === "1080") return 1080;
  return undefined;
}

function parseHintObject(h: Record<string, unknown>): VideoBillingHint | undefined {
  const apiModel = typeof h.apiModel === "string" ? h.apiModel.trim() : undefined;
  const resolution = typeof h.resolution === "string" ? h.resolution.trim() : undefined;
  const durationSec =
    typeof h.durationSec === "number" && Number.isFinite(h.durationSec)
      ? h.durationSec
      : undefined;
  const srRaw =
    typeof h.sr === "number" && Number.isFinite(h.sr) ? Math.floor(h.sr) : undefined;
  const sr = srRaw != null && srRaw > 0 ? srRaw : resolutionHintToSr(resolution);
  const audio = typeof h.audio === "boolean" ? h.audio : undefined;
  if (!apiModel && durationSec == null && sr == null && audio == null && !resolution) {
    return undefined;
  }
  return {
    apiModel: apiModel || undefined,
    durationSec: durationSec != null ? durationSec : undefined,
    sr: sr ?? undefined,
    resolution: resolution || undefined,
    audio,
  };
}

export function videoBillingHintFromJsonBody(
  body: Record<string, unknown>,
): VideoBillingHint | undefined {
  const hintRaw = body.billingHint;
  if (!hintRaw || typeof hintRaw !== "object") return undefined;
  return parseHintObject(hintRaw as Record<string, unknown>);
}

/** 从任务 JSON 读取 usage（及少量 output）侧时长/分辨率。 */
export function extractVideoUsageFromTask(raw: unknown): {
  durationSec?: number;
  sr?: number;
} {
  if (!raw || typeof raw !== "object") return {};
  const top = raw as Record<string, unknown>;
  const usage = top.usage;
  const durationRaw = readNumber(
    usage,
    "output_video_duration",
    "duration",
    "video_duration",
  );
  let durationSec =
    typeof durationRaw === "number" && durationRaw > 0
      ? Math.max(1, Math.ceil(durationRaw))
      : undefined;

  const srRaw = readNumber(usage, "SR", "sr", "video_sr");
  const sr =
    typeof srRaw === "number" && srRaw > 0 ? Math.floor(srRaw) : undefined;

  const out = top.output;
  if (durationSec == null && out && typeof out === "object") {
    const d2 = readNumber(out, "duration", "video_duration", "length");
    if (typeof d2 === "number" && d2 > 0) {
      durationSec = Math.max(1, Math.ceil(d2));
    }
  }

  return { durationSec, sr };
}

function resolveAudio(raw: unknown, hint?: VideoBillingHint | null): boolean {
  const top = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  if (top) {
    const input = top.input;
    if (input && typeof input === "object") {
      const p = (input as Record<string, unknown>).parameters;
      if (p && typeof p === "object" && "audio" in p) {
        const a = readBool(p, "audio");
        if (typeof a === "boolean") return a;
      }
    }
  }
  if (hint?.audio != null) return hint.audio;
  return true;
}

/**
 * @param raw DashScope 任务查询完整响应体
 * @param hint 客户端兜底（仅当任务 JSON 未给出 model 时须带 apiModel）
 */
export function extractVideoTaskBillingContext(
  raw: unknown,
  hint?: VideoBillingHint | null,
): VideoTaskBillingContext | null {
  const apiModel =
    (extractDashScopeTaskModel(raw)?.trim() ||
      (typeof hint?.apiModel === "string" ? hint.apiModel.trim() : "")) ||
    "";
  if (!apiModel) return null;

  const usageMetrics = extractVideoUsageFromTask(raw);
  let durationSec =
    usageMetrics.durationSec ??
    (typeof hint?.durationSec === "number" &&
    Number.isFinite(hint.durationSec) &&
    hint.durationSec > 0
      ? Math.max(1, Math.ceil(hint.durationSec))
      : 1);

  durationSec = Math.max(1, Math.min(120, durationSec));

  let sr =
    usageMetrics.sr ??
    (typeof hint?.sr === "number" && hint.sr > 0
      ? Math.floor(hint.sr)
      : resolutionHintToSr(hint?.resolution) ?? 720);
  if (!Number.isFinite(sr) || sr <= 0) sr = 720;

  const audio = resolveAudio(raw, hint);

  return { apiModel, durationSec, sr, audio };
}
