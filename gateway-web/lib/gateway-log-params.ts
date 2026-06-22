/** Gateway 日志 Params / Result 展示与复制 */

export type LogParamsView = {
  model: string;
  /** 单元格内单行缩略 */
  inputPreviewLine: string;
  /** Tip 内完整格式化 JSON */
  inputFullJson: string;
  /** 复制用全文 */
  copyText: string;
};

export type LogInputImageItem = {
  /** 如 Image 1、first_frame */
  label: string;
  url: string;
  /** 厂商角色：reference_image / first_frame / reference 等 */
  role?: string;
  /** false = asset:// 等人像库引用，浏览器无法直接预览 */
  previewable?: boolean;
};

const PREVIEW_MAX_CHARS = 220;

function truncateDeep(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[…]";
  if (typeof value === "string") {
    return value.length > 120 ? `${value.slice(0, 117)}…` : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 6).map((item) => truncateDeep(item, depth + 1));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(
      0,
      24,
    )) {
      out[k] = truncateDeep(v, depth + 1);
    }
    return out;
  }
  return value;
}

function parseInputSummary(inputSummary: unknown): {
  model: string;
  input: Record<string, unknown>;
} {
  const raw =
    inputSummary && typeof inputSummary === "object"
      ? (inputSummary as Record<string, unknown>)
      : {};
  const model = typeof raw.model === "string" ? raw.model : "—";
  let input: unknown = raw.input;
  if (input == null) {
    const { model: _m, ...rest } = raw;
    input = Object.keys(rest).length ? rest : {};
  }
  const inputObj =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : { value: input };
  return { model, input: inputObj };
}

/** 视频任务 Params · 提取可读 prompt（Volcengine content / 百炼 prompt 等） */
export function extractLogVideoPrompt(inputSummary: unknown): string {
  const { input } = parseInputSummary(inputSummary);
  if (typeof input.prompt === "string" && input.prompt.trim()) {
    return input.prompt.trim();
  }
  const content = input.content;
  if (Array.isArray(content)) {
    const texts: string[] = [];
    for (const item of content) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      if (typeof row.text === "string" && row.text.trim()) {
        texts.push(row.text.trim());
      }
    }
    if (texts.length) return texts.join(" | ");
  }
  return "";
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//.test(value.trim());
}

function isLogImageRef(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const t = value.trim();
  return /^https?:\/\//.test(t) || t.startsWith("asset://");
}

function readSbv1ImageHint(inputSummary: unknown): number | null {
  if (!inputSummary || typeof inputSummary !== "object") return null;
  const root = inputSummary as Record<string, unknown>;
  const input =
    root.input && typeof root.input === "object" && !Array.isArray(root.input)
      ? (root.input as Record<string, unknown>)
      : root;
  const billing =
    (root.sbv1Billing && typeof root.sbv1Billing === "object"
      ? root.sbv1Billing
      : input.sbv1Billing) ?? null;
  if (!billing || typeof billing !== "object" || Array.isArray(billing)) return null;
  const b = billing as Record<string, unknown>;
  const imageInputCount =
    typeof b.imageInputCount === "number" && b.imageInputCount > 0
      ? b.imageInputCount
      : 0;
  const referenceImageCount =
    typeof b.referenceImageCount === "number" && b.referenceImageCount > 0
      ? b.referenceImageCount
      : 0;
  const total = imageInputCount + referenceImageCount;
  return total > 0 ? total : null;
}

/** sbv1 等人像库参考：无 https 图时展示计数提示 */
export function readLogInputImageHint(inputSummary: unknown): number | null {
  return readSbv1ImageHint(inputSummary);
}

function extractContentImages(
  content: unknown,
  seen: Set<string>,
  push: (url: string, label: string, role?: string) => void,
) {
  if (!Array.isArray(content)) return;
  let imgIdx = 0;
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    if (b.type !== "image_url") continue;
    const imageUrl = b.image_url;
    const url =
      imageUrl && typeof imageUrl === "object"
        ? (imageUrl as Record<string, unknown>).url
        : typeof imageUrl === "string"
          ? imageUrl
          : undefined;
    if (!isLogImageRef(url)) continue;
    imgIdx += 1;
    const role = typeof b.role === "string" ? b.role : undefined;
    push(url, imageLabel(imgIdx, role), role);
  }
}

function imageLabel(index: number, role?: string): string {
  const base = `Image ${index}`;
  if (role === "first_frame") return `${base} · first_frame`;
  if (role === "reference_image") return `${base} · ref`;
  if (role && role !== "reference") return `${base} · ${role}`;
  return base;
}

/** 从 Params inputSummary 提取请求侧参考图（顺序与 API 数组一致） */
export function extractLogInputImages(inputSummary: unknown): LogInputImageItem[] {
  const { model: _model, input } = parseInputSummary(inputSummary);
  const root =
    inputSummary && typeof inputSummary === "object" && !Array.isArray(inputSummary)
      ? (inputSummary as Record<string, unknown>)
      : {};
  const items: LogInputImageItem[] = [];
  const seen = new Set<string>();

  const push = (url: string, label: string, role?: string) => {
    const u = url.trim();
    if (!isLogImageRef(u) || seen.has(u)) return;
    seen.add(u);
    items.push({
      label,
      url: u,
      role,
      previewable: isHttpUrl(u),
    });
  };

  if (isLogImageRef(input.mainFrameImageUrl)) {
    push(String(input.mainFrameImageUrl), imageLabel(1, "first_frame"), "first_frame");
  }
  if (isLogImageRef(input.lastFrameImageUrl)) {
    push(String(input.lastFrameImageUrl), imageLabel(items.length || 1, "last_frame"), "last_frame");
  }
  if (isLogImageRef(input.lastFrameUrl)) {
    push(String(input.lastFrameUrl), imageLabel(items.length || 1, "last_frame"), "last_frame");
  }

  if (Array.isArray(input.referenceImageUrls)) {
    let idx = 1;
    for (const u of input.referenceImageUrls) {
      if (isLogImageRef(u)) {
        push(u, imageLabel(idx, "reference"), "reference");
        idx += 1;
      }
    }
  }

  if (Array.isArray(input.imageUrls)) {
    let idx = items.length + 1;
    for (const u of input.imageUrls) {
      if (isLogImageRef(u)) {
        push(u, imageLabel(idx), "image");
        idx += 1;
      }
    }
  }

  if (Array.isArray(input.reference_urls)) {
    let idx = items.length + 1;
    for (const u of input.reference_urls) {
      if (isLogImageRef(u)) {
        push(u, imageLabel(idx, "reference"), "reference");
        idx += 1;
      }
    }
  }

  if (isLogImageRef(input.imageUrl)) {
    const role =
      input.kind === "virtual" || input.kind === "real"
        ? String(input.kind)
        : "image";
    const label =
      input.kind === "virtual"
        ? "入库原图 · 虚拟人像"
        : input.kind === "real"
          ? "入库原图 · 真人人像"
          : imageLabel(1, "image");
    push(String(input.imageUrl), label, role);
  }
  if (isLogImageRef(input.image_url)) {
    push(String(input.image_url), imageLabel(items.length || 1, "image"), "image");
  }

  if (Array.isArray(input.image_urls)) {
    let idx = items.length + 1;
    for (const u of input.image_urls) {
      if (isLogImageRef(u)) {
        push(u, imageLabel(idx), "image");
        idx += 1;
      }
    }
  }

  if (Array.isArray(input.media)) {
    let idx = items.length + 1;
    for (const row of input.media) {
      if (!row || typeof row !== "object") continue;
      const url = (row as Record<string, unknown>).url;
      const type = (row as Record<string, unknown>).type;
      if (isLogImageRef(url)) {
        const role = typeof type === "string" ? type : "media";
        push(String(url), imageLabel(idx, role), role);
        idx += 1;
      }
    }
  }

  extractContentImages(input.content, seen, push);
  if (root.content && root.content !== input.content) {
    extractContentImages(root.content, seen, push);
  }

  const nestedInput = input.input;
  if (nestedInput && typeof nestedInput === "object" && !Array.isArray(nestedInput)) {
    const nested = extractLogInputImages({
      model: "",
      input: nestedInput as Record<string, unknown>,
    });
    let idx = items.length + 1;
    for (const row of nested) {
      if (seen.has(row.url)) continue;
      push(row.url, imageLabel(idx, row.role), row.role);
      idx += 1;
    }
  }

  return items;
}

export function formatLogParamsView(inputSummary: unknown): LogParamsView {
  const { model, input } = parseInputSummary(inputSummary);
  const inputFullJson = JSON.stringify(input, null, 2);
  const compact = JSON.stringify(truncateDeep(input));
  const inputPreviewLine =
    compact.length > PREVIEW_MAX_CHARS
      ? `${compact.slice(0, PREVIEW_MAX_CHARS - 1)}…`
      : compact;
  const copyText = `input:\n${inputFullJson}\n\nmodel: ${model}`;
  return { model, inputPreviewLine, inputFullJson, copyText };
}

function collectUrls(value: unknown, out: string[]): void {
  if (typeof value === "string" && /^https?:\/\//.test(value)) {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectUrls(item, out);
    return;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectUrls(v, out);
    }
  }
}

export function extractLogResultUrls(resultSummary: unknown): string[] {
  if (!resultSummary) return [];
  const urls: string[] = [];

  if (resultSummary && typeof resultSummary === "object") {
    const obj = resultSummary as Record<string, unknown>;
    if (Array.isArray(obj.imageUrls)) {
      for (const u of obj.imageUrls) {
        if (typeof u === "string" && /^https?:\/\//.test(u)) urls.push(u);
      }
    }
    if (typeof obj.resultJson === "string") {
      try {
        let parsed: unknown = JSON.parse(obj.resultJson);
        if (typeof parsed === "string") {
          try {
            parsed = JSON.parse(parsed);
          } catch {
            /* keep string */
          }
        }
        collectUrls(parsed, urls);
      } catch {
        collectUrls(obj.resultJson, urls);
      }
    }
    if (typeof obj.video_url === "string") urls.push(obj.video_url);
    if (obj.output && typeof obj.output === "object") {
      collectUrls(obj.output, urls);
    }
  }

  collectUrls(resultSummary, urls);
  return [...new Set(urls.filter((u) => /^https?:\/\//.test(u)))];
}

export function pickLogPreviewUrl(resultSummary: unknown): string | null {
  const urls = extractLogResultUrls(resultSummary);
  if (urls[0]) return urls[0];
  return null;
}

export function pickLogResultPreviewText(resultSummary: unknown): string | null {
  if (!resultSummary || typeof resultSummary !== "object") return null;
  const obj = resultSummary as Record<string, unknown>;
  if (obj.kind === "chat" && typeof obj.text === "string" && obj.text.trim()) {
    return obj.text.trim();
  }
  return null;
}

export type CreditsDisplay = {
  value: string;
  title: string;
};

/** Usage 列：仅展示挂牌参考费用（元），供后续费用统计 */
export function formatUsageYuanDisplay(
  estimatedVendorCostYuan: string | null,
): CreditsDisplay {
  if (estimatedVendorCostYuan != null && estimatedVendorCostYuan !== "") {
    const n = Number(estimatedVendorCostYuan);
    if (!Number.isNaN(n) && n > 0) {
      return {
        value: n < 1 ? n.toFixed(4) : n.toFixed(2),
        title:
          "挂牌参考费用（元，非钱包扣点）· 来自 B 表定价估算，供费用统计",
      };
    }
  }
  return { value: "—", title: "暂无费用估算（非扣费失败）" };
}

/** 平台积分列：Finance 2.0 扣减积分（GatewayRequestLog.creditsCharged） */
export function formatPlatformCreditsDisplay(
  creditsCharged: number | null | undefined,
): CreditsDisplay {
  if (creditsCharged != null && Number.isFinite(creditsCharged) && creditsCharged > 0) {
    return {
      value: creditsCharged.toLocaleString("zh-CN"),
      title: "平台代付扣减积分（Finance 2.0 · 与 finance-web 扣减明细一致）",
    };
  }
  return {
    value: "—",
    title: "未扣积分（BYOK / 失败 / 未结算 / 进行中）",
  };
}

export type TokenDisplay = {
  value: string;
  title: string;
};

/** Token 列：厂商回传优先，否则平台按 prompt/输出文本估算 */
export function formatTokenDisplay(
  totalTokens: number | null,
  promptTokens: number | null,
  completionTokens: number | null,
  metricsSource?: string | null,
): TokenDisplay {
  if (totalTokens != null && totalTokens > 0) {
    const sourceLabel =
      metricsSource === "VENDOR"
        ? "厂商回传"
        : metricsSource === "PLATFORM"
          ? "平台估算（CJK 1字≈1tok，其余≈4字/tok）"
          : "Token 计量";
    const detail =
      promptTokens != null && completionTokens != null
        ? `${sourceLabel} · 输入 ${promptTokens} + 输出 ${completionTokens} = ${totalTokens} tok`
        : promptTokens != null
          ? `${sourceLabel} · 输入 ${promptTokens} tok`
          : `${sourceLabel} · 合计 ${totalTokens} tok`;
    return { value: `${totalTokens} tok`, title: detail };
  }
  return { value: "—", title: "暂无 Token 记录" };
}

/** @deprecated 使用 formatUsageYuanDisplay + formatTokenDisplay */
export function formatCreditsDisplay(
  estimatedVendorCostYuan: string | null,
  totalTokens: number | null,
  promptTokens: number | null,
  completionTokens: number | null,
): CreditsDisplay {
  const usage = formatUsageYuanDisplay(estimatedVendorCostYuan);
  if (usage.value !== "—") return usage;
  return formatTokenDisplay(
    totalTokens,
    promptTokens,
    completionTokens,
  ) as CreditsDisplay;
}

export function isImageResultUrl(url: string): boolean {
  return /\.(png|jpe?g|webp|gif|bmp|svg)(\?|$)/i.test(url);
}

export function isVideoResultUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m3u8)(\?|$)/i.test(url) || /video/i.test(url);
}

export function formatLogResultText(resultSummary: unknown): string {
  if (resultSummary == null) return "";
  if (typeof resultSummary === "string") return resultSummary;
  return JSON.stringify(resultSummary, null, 2);
}

export function formatLogTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function formatDurationSeconds(durationMs: number | null): string {
  if (durationMs == null || durationMs < 0) return "—";
  return `${Math.round(durationMs / 1000)}s`;
}

/** 日志 status 是否进行中（兼容大小写） */
export function isLogInProgress(status: string): boolean {
  const s = status.trim().toUpperCase();
  return s === "RUNNING" || s === "PENDING";
}

/** 优先用 durationMs（>0）；0 视为未写入，回退 completedAt - submittedAt；进行中可回退 now - submittedAt */
export function resolveLogDurationMs(
  durationMs: number | null,
  submittedAt: string,
  completedAt: string | null,
  opts?: { inProgress?: boolean; nowMs?: number },
): number | null {
  if (durationMs != null && durationMs > 0) return durationMs;
  if (opts?.inProgress && !completedAt) {
    const ms =
      (opts.nowMs ?? Date.now()) - new Date(submittedAt).getTime();
    return ms >= 0 ? ms : null;
  }
  if (!completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(submittedAt).getTime();
  return ms >= 0 ? ms : null;
}

/**
 * 日志表 Duration 列。
 * 进行中：优先 live 拆分总耗时 / 墙钟递增，忽略 DB 里仅 poll 时写入的 durationMs；
 * 终态：用已落库的 durationMs 或 completedAt − submittedAt。
 */
export function resolveLogDisplayDurationMs(input: {
  durationMs: number | null;
  submittedAt: string;
  completedAt: string | null;
  isInProgress: boolean;
  nowMs: number | null;
  queueMs?: number | null;
  generateMs?: number | null;
  vendorPostProcessMs?: number | null;
  pollDelayMs?: number | null;
  /** liveVolcengineVideoTiming.totalMs 或 resolveLiveLogPhaseTiming.totalMs */
  liveTotalMs?: number | null;
}): number | null {
  if (input.isInProgress) {
    if (input.liveTotalMs != null && input.liveTotalMs > 0) {
      return input.liveTotalMs;
    }
    if (input.nowMs != null) {
      const wall = input.nowMs - new Date(input.submittedAt).getTime();
      if (wall >= 0) return wall;
    }
    const phaseSum =
      Math.max(0, input.queueMs ?? 0) +
      Math.max(0, input.generateMs ?? 0) +
      Math.max(0, input.vendorPostProcessMs ?? 0) +
      Math.max(0, input.pollDelayMs ?? 0);
    if (phaseSum > 0) return phaseSum;
    return null;
  }

  return resolveLogDurationMs(
    input.durationMs,
    input.submittedAt,
    input.completedAt,
  );
}

/** 进行中任务 · 从 resultSummary 解析厂商进度文案 */
export function pickLogProgressLabel(
  status: string,
  resultSummary: unknown,
): string | null {
  const normalized = status.toUpperCase();
  if (normalized !== "RUNNING" && normalized !== "PENDING") return null;
  if (!resultSummary || typeof resultSummary !== "object") {
    return null;
  }
  const obj = resultSummary as Record<string, unknown>;
  if (obj.kind === "task_progress") {
    const vendor = typeof obj.status === "string" ? obj.status.trim() : "";
    const detail = typeof obj.detail === "string" ? obj.detail.trim() : "";
    if (vendor && detail) return `${vendor} · ${detail}`;
    if (vendor && vendor.toLowerCase() !== normalized.toLowerCase()) return vendor;
  }
  const candidates = [
    obj.task_status,
    obj.status,
    obj.state,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      const t = c.trim();
      if (t.toLowerCase() === normalized.toLowerCase()) continue;
      return t;
    }
  }
  return null;
}

export function formatCreditsConsumed(
  estimatedVendorCostYuan: string | null,
  totalTokens: number | null,
): string {
  const usage = formatUsageYuanDisplay(estimatedVendorCostYuan);
  if (usage.value !== "—") return usage.value;
  return formatTokenDisplay(totalTokens, null, null).value;
}

const LOG_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function isLogDateRangeInvalid(from: string, to: string): boolean {
  if (!from || !to) return false;
  return from > to;
}

/** 按 Submitted 是否在开始/结束日期内（闭区间，与 API from/to 同为 UTC 日历日） */
export function logSubmittedInUtcDateRange(
  submittedAt: string,
  from: string,
  to: string,
): boolean {
  const t = new Date(submittedAt).getTime();
  if (Number.isNaN(t)) return false;
  if (from && LOG_DATE_ONLY.test(from.trim())) {
    const start = new Date(`${from.trim()}T00:00:00.000Z`).getTime();
    if (t < start) return false;
  }
  if (to && LOG_DATE_ONLY.test(to.trim())) {
    const end = new Date(`${to.trim()}T23:59:59.999Z`).getTime();
    if (t > end) return false;
  }
  return true;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}
