import type { GatewayRequestKind, GatewayMetricsSource } from "@prisma/client";

/** 厂商响应中的 token usage（OpenAI / DashScope input_tokens 等） */
export type UsageFromResponse = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type ResolvedTokenMetrics = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  metricsSource: GatewayMetricsSource;
  hasTokenUsage: boolean;
};

function toPositiveInt(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.trim());
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return undefined;
}

function normalizeUsage(usage?: UsageFromResponse): ResolvedTokenMetrics | null {
  if (!usage) return null;
  const promptTokens = toPositiveInt(usage.promptTokens);
  const completionTokens = toPositiveInt(usage.completionTokens);
  let totalTokens = toPositiveInt(usage.totalTokens);
  if (totalTokens == null && (promptTokens != null || completionTokens != null)) {
    totalTokens = (promptTokens ?? 0) + (completionTokens ?? 0);
  }
  if (totalTokens == null && promptTokens == null && completionTokens == null) {
    return null;
  }
  return {
    promptTokens: promptTokens ?? null,
    completionTokens: completionTokens ?? null,
    totalTokens: totalTokens ?? null,
    metricsSource: "VENDOR",
    hasTokenUsage: true,
  };
}

/** 从厂商响应 JSON 解析 usage（OpenAI / DashScope input_tokens 等） */
export function parseUsageFromUnknown(raw: unknown): UsageFromResponse {
  if (!raw || typeof raw !== "object") return {};
  const seen = new Set<unknown>();
  const queue: unknown[] = [raw];

  while (queue.length) {
    const cur = queue.shift();
    if (!cur || typeof cur !== "object" || seen.has(cur)) continue;
    seen.add(cur);
    const obj = cur as Record<string, unknown>;

    const usage = obj.usage;
    if (usage && typeof usage === "object" && !Array.isArray(usage)) {
      const u = usage as Record<string, unknown>;
      const promptTokens =
        toPositiveInt(u.prompt_tokens) ??
        toPositiveInt(u.input_tokens) ??
        toPositiveInt(u.promptTokens);
      const completionTokens =
        toPositiveInt(u.completion_tokens) ??
        toPositiveInt(u.output_tokens) ??
        toPositiveInt(u.completionTokens);
      const totalTokens =
        toPositiveInt(u.total_tokens) ??
        toPositiveInt(u.totalTokens) ??
        (promptTokens != null || completionTokens != null
          ? (promptTokens ?? 0) + (completionTokens ?? 0)
          : undefined);
      if (totalTokens != null || promptTokens != null || completionTokens != null) {
        return { promptTokens, completionTokens, totalTokens };
      }
    }

    for (const v of Object.values(obj)) {
      if (v && typeof v === "object") queue.push(v);
    }
  }

  return {};
}

/**
 * 通义 / OpenAI 兼容粗算：CJK 每字 1 token，其余字符按 4 字符 ≈ 1 token。
 * 用于异步任务（视频/生图）在无厂商 usage 时的输入侧计量。
 */
export function estimateQwenTextTokens(text: string): number {
  const s = text.trim();
  if (!s) return 0;
  let cjk = 0;
  let other = 0;
  for (const ch of s) {
    if (/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(ch)) cjk += 1;
    else other += 1;
  }
  return cjk + Math.ceil(other / 4);
}

function readInputObject(inputSummary: unknown): Record<string, unknown> {
  if (!inputSummary || typeof inputSummary !== "object") return {};
  const root = inputSummary as Record<string, unknown>;
  const input = root.input;
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  return root;
}

function pushText(out: string[], raw: unknown) {
  if (typeof raw === "string" && raw.trim()) out.push(raw.trim());
}

function collectMessageTexts(messages: unknown, out: string[]) {
  if (!Array.isArray(messages)) return;
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    const m = msg as Record<string, unknown>;
    const content = m.content;
    if (typeof content === "string") {
      pushText(out, content);
      continue;
    }
    if (Array.isArray(content)) {
      for (const part of content) {
        if (!part || typeof part !== "object") continue;
        const p = part as Record<string, unknown>;
        if (p.type === "text" && typeof p.text === "string") pushText(out, p.text);
      }
    }
  }
}

/** 从 inputSummary 抽取计入 prompt 的文本 */
export function extractPromptTextsFromInputSummary(
  inputSummary: unknown,
): string[] {
  const input = readInputObject(inputSummary);
  const texts: string[] = [];
  pushText(texts, input.prompt);
  collectMessageTexts(input.messages, texts);
  if (Array.isArray(input.content)) {
    for (const block of input.content) {
      if (!block || typeof block !== "object") continue;
      const b = block as Record<string, unknown>;
      if (b.type === "text" && typeof b.text === "string") pushText(texts, b.text);
    }
  }
  return texts;
}

/** 从 resultSummary 抽取 completion 文本（Chat 等） */
export function extractCompletionTextsFromResultSummary(
  resultSummary: unknown,
): string[] {
  if (!resultSummary || typeof resultSummary !== "object") return [];
  const obj = resultSummary as Record<string, unknown>;
  const texts: string[] = [];
  if (typeof obj.text === "string") pushText(texts, obj.text);
  const choice = Array.isArray(obj.choices)
    ? (obj.choices[0] as Record<string, unknown> | undefined)
    : undefined;
  const message =
    choice?.message && typeof choice.message === "object"
      ? (choice.message as Record<string, unknown>)
      : null;
  if (message && typeof message.content === "string") pushText(texts, message.content);
  return texts;
}

export function resolveGatewayTokenMetrics(opts: {
  usage?: UsageFromResponse;
  inputSummary?: unknown;
  resultSummary?: unknown;
  requestKind?: GatewayRequestKind | string;
}): ResolvedTokenMetrics {
  const fromPatch = normalizeUsage(opts.usage);
  if (fromPatch?.hasTokenUsage) return fromPatch;

  const fromResult = normalizeUsage(parseUsageFromUnknown(opts.resultSummary));
  if (fromResult?.hasTokenUsage) return fromResult;

  const promptTexts = extractPromptTextsFromInputSummary(opts.inputSummary);
  const completionTexts =
    opts.requestKind === "CHAT"
      ? extractCompletionTextsFromResultSummary(opts.resultSummary)
      : [];

  const promptTokens = promptTexts.reduce(
    (sum, t) => sum + estimateQwenTextTokens(t),
    0,
  );
  const completionTokens = completionTexts.reduce(
    (sum, t) => sum + estimateQwenTextTokens(t),
    0,
  );

  if (promptTokens > 0 || completionTokens > 0) {
    return {
      promptTokens: promptTokens > 0 ? promptTokens : null,
      completionTokens: completionTokens > 0 ? completionTokens : null,
      totalTokens: promptTokens + completionTokens,
      metricsSource: "PLATFORM",
      hasTokenUsage: true,
    };
  }

  return {
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    metricsSource: "UNAVAILABLE",
    hasTokenUsage: false,
  };
}
