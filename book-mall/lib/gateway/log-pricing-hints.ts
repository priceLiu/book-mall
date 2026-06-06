/** 从 Gateway 日志 inputSummary 解析视频计价参数 */

export type VideoPricingHints = {
  durationSec?: number;
  tierRaw?: string;
};

function readInputObject(inputSummary: unknown): Record<string, unknown> {
  if (!inputSummary || typeof inputSummary !== "object") return {};
  const root = inputSummary as Record<string, unknown>;
  const input = root.input;
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  return root;
}

function parsePositiveInt(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.trim());
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return undefined;
}

export function parseVideoPricingHints(
  inputSummary: unknown,
): VideoPricingHints {
  const input = readInputObject(inputSummary);
  const durationSec =
    parsePositiveInt(input.duration) ??
    parsePositiveInt(input.durationSec) ??
    parsePositiveInt(
      input.parameters &&
        typeof input.parameters === "object" &&
        !Array.isArray(input.parameters)
        ? (input.parameters as Record<string, unknown>).duration
        : undefined,
    );

  let tierRaw: string | undefined;
  const resolution = input.resolution ?? input.video_resolution;
  if (typeof resolution === "string" && resolution.trim()) {
    tierRaw = resolution.trim().toUpperCase();
  } else if (typeof input.resolution === "string") {
    tierRaw = input.resolution.trim().toLowerCase().includes("1080")
      ? "1080P"
      : input.resolution.trim().toLowerCase().includes("720")
        ? "720P"
        : undefined;
  }

  return { durationSec, tierRaw };
}
