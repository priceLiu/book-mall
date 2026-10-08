import type { WorkflowEnvelope } from "@/lib/ecom/video-workflow/envelope";
import { parseSimpleFusionPayload } from "@/lib/ecom/video-workflow/templates/simple-fusion-i2v-v1/schema";
import { SIMPLE_FUSION_I2V_V1_TEMPLATE_ID } from "@/lib/ecom/video-workflow/templates/simple-fusion-i2v-v1/constants";

export function parseSimpleFusionI2vEnvelope(envelope: WorkflowEnvelope): {
  ok: boolean;
  envelope?: WorkflowEnvelope;
  payload?: NonNullable<ReturnType<typeof parseSimpleFusionPayload>>;
  error?: string;
} {
  if (envelope.templateId !== SIMPLE_FUSION_I2V_V1_TEMPLATE_ID) {
    return { ok: false, error: `templateId 不匹配：${envelope.templateId}` };
  }
  const payload = parseSimpleFusionPayload(envelope.action, envelope.payload);
  if (!payload) return { ok: false, error: `无法解析 action: ${envelope.action}` };
  return { ok: true, envelope, payload };
}
