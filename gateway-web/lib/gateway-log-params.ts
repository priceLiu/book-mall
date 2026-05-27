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

export function formatCreditsDisplay(
  estimatedVendorCostYuan: string | null,
  totalTokens: number | null,
  promptTokens: number | null,
  completionTokens: number | null,
): CreditsDisplay {
  if (estimatedVendorCostYuan != null && estimatedVendorCostYuan !== "") {
    const n = Number(estimatedVendorCostYuan);
    if (!Number.isNaN(n) && n > 0) {
      return {
        value: n < 1 ? n.toFixed(4) : n.toFixed(2),
        title: "预估厂商成本（元）",
      };
    }
  }
  if (totalTokens != null && totalTokens > 0) {
    const detail =
      promptTokens != null && completionTokens != null
        ? `输入 ${promptTokens} + 输出 ${completionTokens}`
        : "LLM Token 总用量";
    return {
      value: `${totalTokens} tok`,
      title: detail,
    };
  }
  return { value: "0", title: "暂无用量" };
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

/** 优先用 durationMs；否则用 completedAt - submittedAt 推算 */
export function resolveLogDurationMs(
  durationMs: number | null,
  submittedAt: string,
  completedAt: string | null,
): number | null {
  if (durationMs != null && durationMs >= 0) return durationMs;
  if (!completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(submittedAt).getTime();
  return ms >= 0 ? ms : null;
}

export function formatCreditsConsumed(
  estimatedVendorCostYuan: string | null,
  totalTokens: number | null,
): string {
  return formatCreditsDisplay(
    estimatedVendorCostYuan,
    totalTokens,
    null,
    null,
  ).value;
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
