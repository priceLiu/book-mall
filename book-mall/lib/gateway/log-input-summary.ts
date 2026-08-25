/** Gateway 请求日志 · 统一 inputSummary 结构（与控制台 Params 列对齐） */

const MAX_STRING_LEN = 8000;
const MAX_DEPTH = 12;

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return "[truncated]";
  if (value == null) return value;
  if (typeof value === "string") {
    return value.length > MAX_STRING_LEN
      ? `${value.slice(0, MAX_STRING_LEN)}…`
      : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 64).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(
      0,
      80,
    )) {
      out[k] = sanitizeValue(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

/** `{ model, input }` — 控制台 Params 列与 hover 完整 JSON 均基于此 */
export function buildGatewayInputSummary(
  model: string,
  input: Record<string, unknown>,
): { model: string; input: Record<string, unknown> } {
  const sanitized = sanitizeValue(input, 0);
  return {
    model: model.trim(),
    input:
      sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)
        ? (sanitized as Record<string, unknown>)
        : { value: sanitized },
  };
}

/**
 * DashScope createTask · 写入 GatewayRequestLog.inputSummary 的请求快照。
 * video 任务的 prompt/media/parameters 在 body.dashscope.videoBody，须展开后再记日志。
 */
export function buildDashscopeCreateTaskInputForLog(
  ds: Record<string, unknown>,
  fallbackInput?: Record<string, unknown> | null,
): Record<string, unknown> {
  const jobKind = ds.jobKind;
  if (jobKind === "video") {
    const videoBody =
      (ds.videoBody as Record<string, unknown> | undefined) ??
      fallbackInput ??
      {};
    const inner =
      videoBody.input && typeof videoBody.input === "object" && !Array.isArray(videoBody.input)
        ? (videoBody.input as Record<string, unknown>)
        : {};
    const parameters =
      videoBody.parameters &&
      typeof videoBody.parameters === "object" &&
      !Array.isArray(videoBody.parameters)
        ? (videoBody.parameters as Record<string, unknown>)
        : undefined;
    return {
      jobKind: "video",
      ...inner,
      ...(parameters ? { parameters } : {}),
    };
  }
  return {
    jobKind: ds.jobKind,
    prompt: ds.prompt,
    content: ds.content,
    size: ds.size,
    n: ds.n,
    aspectRatio: ds.aspectRatio,
    resolution: ds.resolution,
    contentOrder: ds.contentOrder,
  };
}
