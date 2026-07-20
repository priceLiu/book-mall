/**
 * 画布排队合成日志行 · 从 task.inputPayload 推导 Gateway Params（与 createTask inputSummary 对齐）
 */
import { buildBailianR2vRequestBody } from "@/lib/canvas/bailian-r2v-body";
import { buildGatewayInputSummary } from "@/lib/gateway/log-input-summary";
import { isBailianR2vGatewayModel } from "@/lib/gateway/model-router";

function readPayload(inputPayload: unknown): Record<string, unknown> {
  if (!inputPayload || typeof inputPayload !== "object" || Array.isArray(inputPayload)) {
    return {};
  }
  return inputPayload as Record<string, unknown>;
}

function readStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((u): u is string => typeof u === "string");
}

export function buildCanvasPendingInputSummary(
  model: string | null,
  inputPayload: unknown,
): { model: string; input: Record<string, unknown> } | null {
  const modelKey = (model ?? "").trim();
  if (!modelKey) return null;
  const payload = readPayload(inputPayload);
  const params = (payload.params as Record<string, unknown>) ?? {};

  if (
    payload.providerKind === "BAILIAN_R2V" ||
    isBailianR2vGatewayModel(modelKey)
  ) {
    const prompt = String(payload.prompt ?? "").trim();
    const referenceImageUrls = readStringArray(payload.referenceImageUrls);
    const resolution = /^720p$/i.test(String(params.resolution ?? ""))
      ? "720P"
      : "1080P";
    const built = buildBailianR2vRequestBody({
      model: modelKey,
      prompt,
      referenceImageUrls,
      resolution,
      ratio: String(params.ratio ?? params.aspect_ratio ?? "16:9"),
      duration: Number(params.duration ?? 5),
      seedStr: typeof params.seed === "string" ? params.seed : undefined,
      parameterExtras:
        modelKey.startsWith("wan2.")
          ? { prompt_extend: params.prompt_extend !== false }
          : undefined,
    });
    return buildGatewayInputSummary(modelKey, {
      ...built.input,
      parameters: built.parameters,
      referenceImageUrls,
    });
  }

  if (payload.providerKind === "VOLCENGINE") {
    const body =
      (payload.volcengineBody as Record<string, unknown>) ??
      (payload.input as Record<string, unknown>) ??
      {};
    return buildGatewayInputSummary(
      String(payload.volcengineModel ?? modelKey),
      body,
    );
  }

  if (payload.providerKind === "DASHSCOPE") {
    const body =
      (payload.dashscopeVideoBody as Record<string, unknown>) ??
      (payload.input as Record<string, unknown>) ??
      {};
    return buildGatewayInputSummary(
      String(payload.dashscopeModel ?? modelKey),
      body,
    );
  }

  const kieInput = (payload.kieInput as Record<string, unknown>) ?? {};
  if (Object.keys(kieInput).length > 0) {
    return buildGatewayInputSummary(
      String(payload.kieModel ?? modelKey),
      kieInput,
    );
  }

  const imageUrls = [
    ...readStringArray(payload.imageUrls),
    ...readStringArray(payload.imageInputs),
    ...readStringArray(payload.referenceImageUrls),
  ];
  const main =
    typeof payload.mainFrameImageUrl === "string"
      ? payload.mainFrameImageUrl.trim()
      : "";
  const prompt = String(payload.prompt ?? "").trim();
  if (!prompt && imageUrls.length === 0 && !main) return null;

  return buildGatewayInputSummary(modelKey, {
    prompt,
    ...(main ? { mainFrameImageUrl: main } : {}),
    ...(imageUrls.length ? { imageUrls } : {}),
    params,
  });
}
