import type { WorkflowEnvelope } from "@/lib/ecom/video-workflow/envelope";
import { parseSimpleFusionPayload } from "@/lib/ecom/video-workflow/templates/simple-fusion-i2v-v1/schema";
import { SIMPLE_FUSION_I2V_V1_TEMPLATE_ID } from "@/lib/ecom/video-workflow/templates/simple-fusion-i2v-v1/constants";

export function parseSimpleFusionI2vEnvelope(envelope: WorkflowEnvelope) {
  if (envelope.templateId !== SIMPLE_FUSION_I2V_V1_TEMPLATE_ID) {
    throw new Error(`templateId 不匹配：${envelope.templateId}`);
  }
  const payload = parseSimpleFusionPayload(envelope.action, envelope.payload);
  if (!payload) throw new Error(`无法解析 action: ${envelope.action}`);
  return { envelope, payload };
}
