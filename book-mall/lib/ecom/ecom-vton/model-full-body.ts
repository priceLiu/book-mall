import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { generateEcomImage } from "@/lib/ecom/ecom-image-gen-invoke";
import { buildVtonFullBodyExpandRefCanvas } from "@/lib/ecom/ecom-vton/full-body-expand-ref-layout";
import { detectVtonModelImageBody } from "@/lib/ecom/ecom-vton/model-body-detect";
import {
  VTon_FULL_BODY_EXPAND_NEGATIVE_ZH,
  buildVtonFullBodyExpandPrompt,
} from "@/lib/ecom/ecom-vton/prompts";
import {
  ECOM_VTON_EXPAND_FULL_BODY_ACTION,
  ECOM_VTON_MODEL_GEN_MODEL,
  ECOM_VTON_TOOL_KEY,
  type VtonModelBodyShotType,
} from "@/lib/ecom/ecom-vton/types";

export async function expandVtonModelFullBody(opts: {
  userId: string;
  portraitUrl: string;
  prompt?: string;
  imageSize?: string;
  toolKeySuffix?: string;
  /** 已知取景类型时可跳过 VLM 检测 */
  shotType?: VtonModelBodyShotType;
}): Promise<string> {
  await assertEcomToolkitGatewayAccess(opts.userId);

  const portraitUrl = opts.portraitUrl.trim();
  if (!portraitUrl) throw new Error("请先上传或选择模特头像");

  let shotType = opts.shotType;
  if (!shotType || shotType === "unknown") {
    try {
      const check = await detectVtonModelImageBody({
        userId: opts.userId,
        imageUrl: portraitUrl,
        action: "expand-full-body-detect",
      });
      shotType = check.shotType;
    } catch {
      shotType = "unknown";
    }
  }

  const { refUrl, layout } = await buildVtonFullBodyExpandRefCanvas({
    userId: opts.userId,
    portraitUrl,
    shotType,
  });

  const prompt = buildVtonFullBodyExpandPrompt(opts.prompt, {
    usesCanvasLayout: layout.mode === "canvas",
    elongatedRef: layout.mode === "canvas" && layout.elongated,
  });
  const toolKey = opts.toolKeySuffix
    ? `${ECOM_VTON_TOOL_KEY}__${opts.toolKeySuffix}`
    : `${ECOM_VTON_TOOL_KEY}__${ECOM_VTON_EXPAND_FULL_BODY_ACTION}`;

  return generateEcomImage({
    userId: opts.userId,
    modelKey: ECOM_VTON_MODEL_GEN_MODEL,
    prompt,
    negativePrompt: VTon_FULL_BODY_EXPAND_NEGATIVE_ZH,
    promptExtend: false,
    ratio: "3:4",
    imageSize: opts.imageSize?.trim() || "720*960",
    wan27KeepPixelSizeWithRefs: true,
    refImageUrls: [refUrl],
    toolKey,
  });
}
