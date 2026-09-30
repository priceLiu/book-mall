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
  modelKey?: string;
  ratio?: "1:1" | "3:4" | "4:5" | "16:9" | "9:16";
  toolKeySuffix?: string;
}): Promise<string> {
  await assertEcomToolkitGatewayAccess(opts.userId);

  const prompt = buildVtonModelGeneratePrompt(opts.prompt);
  const modelKey = opts.modelKey?.trim() || ECOM_VTON_MODEL_GEN_MODEL;
  const ratio = opts.ratio ?? "3:4";
  const toolKey = opts.toolKeySuffix
    ? `${ECOM_VTON_TOOL_KEY}__${opts.toolKeySuffix}`
    : `${ECOM_VTON_TOOL_KEY}__${ECOM_VTON_MODEL_GENERATE_ACTION}`;

  return generateEcomImage({
    userId: opts.userId,
    modelKey,
    prompt,
    ratio,
    imageSize: opts.imageSize,
    refImageUrls: [],
    toolKey,
  });
}
