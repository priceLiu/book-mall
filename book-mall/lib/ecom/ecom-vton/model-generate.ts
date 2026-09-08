import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { generateEcomImage } from "@/lib/ecom/ecom-image-gen-invoke";
import {
  ECOM_VTON_MODEL_GENERATE_ACTION,
  ECOM_VTON_TOOL_KEY,
} from "@/lib/ecom/ecom-vton/types";
import { ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";

export async function generateVtonModelImage(opts: {
  userId: string;
  prompt: string;
  modelKey?: string;
  toolKeySuffix?: string;
}): Promise<string> {
  await assertEcomToolkitGatewayAccess(opts.userId);

  const prompt = opts.prompt.trim();
  if (!prompt) throw new Error("请填写生图 Prompt");

  const modelKey = opts.modelKey?.trim() || ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL;
  const toolKey = opts.toolKeySuffix
    ? `${ECOM_VTON_TOOL_KEY}__${opts.toolKeySuffix}`
    : `${ECOM_VTON_TOOL_KEY}__${ECOM_VTON_MODEL_GENERATE_ACTION}`;

  return generateEcomImage({
    userId: opts.userId,
    modelKey,
    prompt,
    ratio: "3:4",
    refImageUrls: [],
    toolKey,
  });
}
