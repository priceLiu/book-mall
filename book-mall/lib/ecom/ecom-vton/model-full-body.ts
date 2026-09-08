import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { generateEcomImage } from "@/lib/ecom/ecom-image-gen-invoke";
import { resolveOutfitFusionModelKey } from "@/lib/ecom/ecom-outfit-video-fusion-models";
import { buildVtonFullBodyExpandPrompt } from "@/lib/ecom/ecom-vton/prompts";
import {
  ECOM_VTON_EXPAND_FULL_BODY_ACTION,
  ECOM_VTON_TOOL_KEY,
} from "@/lib/ecom/ecom-vton/types";

export async function expandVtonModelFullBody(opts: {
  userId: string;
  portraitUrl: string;
  prompt?: string;
  modelKey?: string;
  toolKeySuffix?: string;
}): Promise<string> {
  await assertEcomToolkitGatewayAccess(opts.userId);

  const portraitUrl = opts.portraitUrl.trim();
  if (!portraitUrl) throw new Error("请先上传或选择模特头像");

  const modelKey = resolveOutfitFusionModelKey(opts.modelKey);
  const prompt = buildVtonFullBodyExpandPrompt(opts.prompt);
  const toolKey = opts.toolKeySuffix
    ? `${ECOM_VTON_TOOL_KEY}__${opts.toolKeySuffix}`
    : `${ECOM_VTON_TOOL_KEY}__${ECOM_VTON_EXPAND_FULL_BODY_ACTION}`;

  return generateEcomImage({
    userId: opts.userId,
    modelKey,
    prompt,
    ratio: "9:16",
    refImageUrls: [portraitUrl],
    toolKey,
  });
}
