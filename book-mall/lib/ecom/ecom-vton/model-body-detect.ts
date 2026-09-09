import type { CanvasChatContentPart } from "@/lib/canvas/providers/types";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import {
  ECOM_VTON_MODEL_BODY_DETECT_MODEL,
  ECOM_VTON_TOOL_KEY,
  type VtonModelBodyShotType,
  type VtonModelImageCheck,
} from "@/lib/ecom/ecom-vton/types";
import { ecomGwChatComplete } from "@/lib/gateway/ecom-tool-gateway-client";

const SHOT_TYPES = new Set<VtonModelBodyShotType>([
  "portrait",
  "half_body",
  "full_body",
  "unknown",
]);

function buildBodyDetectPrompt(): string {
  return [
    "你是电商虚拟试衣质检助手。判断图片是否适合作为「单人模特试衣底图」。",
    "",
    "shotType 定义：",
    "- portrait：仅头像或头肩",
    "- half_body：半身（未露出完整双腿）",
    "- full_body：单人完整全身（头到脚在画面内），正面站立试衣底图",
    "- unknown：无法判断",
    "",
    "isFullBody：仅当 shotType=full_body 时为 true。",
    "",
    "只输出一行 JSON，不要 markdown：",
    '{"shotType":"full_body","isFullBody":true}',
  ].join("\n");
}

function parseBodyDetectJson(text: string): Pick<VtonModelImageCheck, "isFullBody" | "shotType"> {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { isFullBody: false, shotType: "unknown" };
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const rawType = typeof parsed.shotType === "string" ? parsed.shotType.trim() : "unknown";
    const shotType = SHOT_TYPES.has(rawType as VtonModelBodyShotType)
      ? (rawType as VtonModelBodyShotType)
      : "unknown";
    const isFullBody =
      parsed.isFullBody === true ||
      (parsed.isFullBody !== false && shotType === "full_body");
    return { isFullBody, shotType };
  } catch {
    return { isFullBody: false, shotType: "unknown" };
  }
}

/** AI 生成的试衣底图 · 跳过 VLM 复检 */
export function vtonModelImageCheckForAiGenerated(ossUrl: string): VtonModelImageCheck {
  return {
    ossUrl,
    isFullBody: true,
    shotType: "full_body",
    checkedAt: new Date().toISOString(),
    fromAiFourView: true,
  };
}

/** @deprecated 使用 vtonModelImageCheckForAiGenerated */
export const vtonModelImageCheckForAiFourView = vtonModelImageCheckForAiGenerated;

export async function detectVtonModelImageBody(opts: {
  userId: string;
  imageUrl: string;
  projectId?: string;
  action?: string;
}): Promise<VtonModelImageCheck> {
  await assertEcomToolkitGatewayAccess(opts.userId);

  const imageUrl = opts.imageUrl.trim();
  if (!imageUrl) throw new Error("缺少模特图 URL");

  const parts: CanvasChatContentPart[] = [
    { type: "image_url", image_url: { url: imageUrl } },
    { type: "text", text: buildBodyDetectPrompt() },
  ];

  const action = opts.action ?? "model-body-detect";
  const clientPage = ecomClientPage(
    opts.userId,
    opts.projectId ?? "vton",
    `${ECOM_VTON_TOOL_KEY}__${action}`,
  );

  const { text } = await ecomGwChatComplete(opts.userId, {
    modelKey: ECOM_VTON_MODEL_BODY_DETECT_MODEL,
    messages: [{ role: "user", content: parts }],
    clientPage,
  });

  const parsed = parseBodyDetectJson(text);
  return {
    ossUrl: imageUrl,
    ...parsed,
    checkedAt: new Date().toISOString(),
  };
}

export function assertVtonModelFullBodyForTryon(check: VtonModelImageCheck | null | undefined): void {
  if (!check?.isFullBody) {
    const hint =
      check?.shotType === "portrait" || check?.shotType === "half_body"
        ? "当前为头像/半身图，请先点击「头像生成全身图」后再试衣。"
        : "请先上传或生成单人正面全身模特照后再试衣。";
    throw new Error(hint);
  }
  if (!check.ossUrl.trim()) {
    throw new Error("请先上传或生成模特全身照");
  }
}
