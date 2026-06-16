/** 生成记录面板 · 厂商 / 模型展示名（勿暴露 Gateway modelKey 裸值） */

const PROVIDER_LABELS: Record<string, string> = {
  VOLCENGINE: "火山方舟",
  KIE: "KIE",
  BAILIAN: "百炼",
  BAILIAN_R2V: "百炼",
  HUNYUAN: "混元",
  HUNYUAN_3D: "混元",
  DASHSCOPE: "通义",
  DEEPSEEK: "DeepSeek",
};

const SBV1_VOLCENGINE_VARIANT_DISPLAY: Record<string, string> = {
  "seedance-2-720p-real": "Seedance 2.0 · 720P",
  "seedance-2-720p-audio-real": "Seedance 2.0 · 720P 有声",
  "seedance-2-fast-720p-real": "Seedance 2.0 Fast · 720P",
  "seedance-2-1080p-real": "Seedance 2.0 · 1080P",
  "seedance-15-pro-1080p-real": "Seedance 1.5 Pro · 1080P",
};

function readPayloadObject(inputPayload: unknown): Record<string, unknown> | null {
  if (!inputPayload || typeof inputPayload !== "object" || Array.isArray(inputPayload)) {
    return null;
  }
  return inputPayload as Record<string, unknown>;
}

function readSbv1Billing(
  payload: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!payload) return null;
  const direct = payload.sbv1Billing;
  if (direct && typeof direct === "object" && !Array.isArray(direct)) {
    return direct as Record<string, unknown>;
  }
  return null;
}

function inferProviderKind(args: {
  payload: Record<string, unknown> | null;
  billing: Record<string, unknown> | null;
  failMessage?: string | null;
}): string | null {
  const pk = args.payload?.providerKind;
  if (typeof pk === "string" && pk.trim()) return pk.trim();

  if (args.billing?.volcengineVariantId) return "VOLCENGINE";
  if (args.billing?.providerId && String(args.billing.providerId).includes("volcengine")) {
    return "VOLCENGINE";
  }

  const fail = args.failMessage ?? "";
  if (fail.includes("火山方舟") || fail.includes("Volcengine") || fail.includes("VOLCENGINE")) {
    return "VOLCENGINE";
  }
  if (fail.includes("百炼") || fail.includes("Bailian")) return "BAILIAN";
  if (fail.includes("混元") || fail.includes("Hunyuan")) return "HUNYUAN";

  const modelKey =
    (typeof args.billing?.modelKey === "string" ? args.billing.modelKey : null) ??
    (typeof args.payload?.modelKey === "string" ? args.payload.modelKey : null) ??
    "";
  if (modelKey.includes("seedance") || modelKey.includes("doubao-seedance")) {
    return "VOLCENGINE";
  }

  return null;
}

function modelLabelFromVariantOrParams(args: {
  model: string;
  billing: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
}): string {
  const variantId =
    (typeof args.billing?.volcengineVariantId === "string"
      ? args.billing.volcengineVariantId
      : null) ??
    (typeof args.payload?.volcengineVariantId === "string"
      ? args.payload.volcengineVariantId
      : null);
  if (variantId?.trim()) {
    const mapped = SBV1_VOLCENGINE_VARIANT_DISPLAY[variantId.trim()];
    if (mapped) return mapped;
  }

  const params =
    args.billing?.paramsSnapshot && typeof args.billing.paramsSnapshot === "object"
      ? (args.billing.paramsSnapshot as Record<string, unknown>)
      : args.payload?.params && typeof args.payload.params === "object"
        ? (args.payload.params as Record<string, unknown>)
        : null;

  const modelKey =
    (typeof args.billing?.modelKey === "string" ? args.billing.modelKey : null) ??
    (typeof args.payload?.modelKey === "string" ? args.payload.modelKey : null) ??
    args.model;

  const res = String(params?.resolution ?? args.billing?.resolution ?? "720p").toLowerCase();
  const audio = params?.generate_audio === true;
  const tier = String(params?.tier ?? "").toLowerCase();

  if (modelKey.includes("seedance-1.5") || modelKey.includes("1.5-pro")) {
    return res.includes("1080")
      ? "Seedance 1.5 Pro · 1080P"
      : "Seedance 1.5 Pro · 720P";
  }
  if (modelKey.includes("seedance") || modelKey.includes("doubao-seedance")) {
    if (tier === "fast") return "Seedance 2.0 Fast · 720P";
    if (res.includes("1080")) return "Seedance 2.0 · 1080P";
    return audio ? "Seedance 2.0 · 720P 有声" : "Seedance 2.0 · 720P";
  }

  return modelKey.trim() || args.model.trim() || "未知模型";
}

export type GenerationRecordLabels = {
  providerLabel: string;
  modelLabel: string;
};

export function resolveGenerationRecordLabels(args: {
  model: string;
  inputPayload?: unknown;
  failMessage?: string | null;
}): GenerationRecordLabels {
  const payload = readPayloadObject(args.inputPayload);
  const billing = readSbv1Billing(payload);
  const providerKind = inferProviderKind({
    payload,
    billing,
    failMessage: args.failMessage,
  });
  const providerLabel =
    (providerKind ? PROVIDER_LABELS[providerKind] : null) ??
    (providerKind ? providerKind : "Gateway");
  const modelLabel = modelLabelFromVariantOrParams({
    model: args.model,
    billing,
    payload,
  });
  return { providerLabel, modelLabel };
}

export function attachGenerationRecordLabels<
  T extends { model: string; failMessage?: string | null; inputPayload?: unknown },
>(
  rows: T[],
): Array<Omit<T, "inputPayload"> & GenerationRecordLabels> {
  return rows.map(({ inputPayload, ...row }) => ({
    ...row,
    ...resolveGenerationRecordLabels({
      model: row.model,
      inputPayload,
      failMessage: row.failMessage,
    }),
  }));
}
