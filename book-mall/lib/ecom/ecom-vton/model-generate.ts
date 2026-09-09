import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { generateEcomImage } from "@/lib/ecom/ecom-image-gen-invoke";
import { buildVtonModelGeneratePrompt } from "@/lib/ecom/ecom-vton/prompts";
import {
  ECOM_VTON_MODEL_GEN_MODEL,
  ECOM_VTON_MODEL_GENERATE_ACTION,
  ECOM_VTON_TOOL_KEY,
} from "@/lib/ecom/ecom-vton/types";

export async function generateVtonModelImage(opts: {
  userId: string;
  prompt?: string;
  imageSize?: string;
  toolKeySuffix?: string;
}): Promise<string> {
  await assertEcomToolkitGatewayAccess(opts.userId);

  const prompt = buildVtonModelGeneratePrompt(opts.prompt);
  const toolKey = opts.toolKeySuffix
    ? `${ECOM_VTON_TOOL_KEY}__${opts.toolKeySuffix}`
    : `${ECOM_VTON_TOOL_KEY}__${ECOM_VTON_MODEL_GENERATE_ACTION}`;

  return generateEcomImage({
    userId: opts.userId,
    modelKey: ECOM_VTON_MODEL_GEN_MODEL,
    prompt,
    ratio: "3:4",
    imageSize: opts.imageSize,
    refImageUrls: [],
    toolKey,
  });
}
