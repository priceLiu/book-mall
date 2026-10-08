import type { WorkflowEnvelope } from "@/lib/ecom/video-workflow/envelope";
import { parseOutfitPayload } from "@/lib/ecom/video-workflow/templates/outfit-v1/schema";
import { parseOutfitV1Envelope } from "@/lib/ecom/video-workflow/templates/outfit-v1/parser";
import { OUTFIT_V1_UI_CONFIG } from "@/lib/ecom/video-workflow/templates/outfit-v1/ui-config";
import { OUTFIT_V1_TEMPLATE_ID } from "@/lib/ecom/video-workflow/templates/outfit-v1/constants";
import { SIMPLE_FUSION_I2V_V1_TEMPLATE_ID } from "@/lib/ecom/video-workflow/templates/simple-fusion-i2v-v1/constants";
import { parseSimpleFusionI2vEnvelope } from "@/lib/ecom/video-workflow/templates/simple-fusion-i2v-v1/parser";
import { parseSimpleFusionPayload } from "@/lib/ecom/video-workflow/templates/simple-fusion-i2v-v1/schema";

export type VideoTemplateParseResult = {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
};

export type VideoTemplateEngine = {
  templateId: string;
  displayName: string;
  moduleId: string;
  parseEnvelope: (envelope: WorkflowEnvelope) => VideoTemplateParseResult;
  validatePayload: (action: string, payload: unknown) => boolean;
  uiConfig: typeof OUTFIT_V1_UI_CONFIG;
};

const OUTFIT_V1_ENGINE: VideoTemplateEngine = {
  templateId: OUTFIT_V1_TEMPLATE_ID,
  displayName: "穿搭动作迁移",
  moduleId: "video-outfit",
  parseEnvelope: parseOutfitV1Envelope,
  validatePayload: (action, payload) => parseOutfitPayload(action, payload) != null,
  uiConfig: OUTFIT_V1_UI_CONFIG,
};

const SIMPLE_FUSION_I2V_V1_ENGINE: VideoTemplateEngine = {
  templateId: SIMPLE_FUSION_I2V_V1_TEMPLATE_ID,
  displayName: "简易融合短视频",
  moduleId: "video-camera",
  parseEnvelope: parseSimpleFusionI2vEnvelope,
  validatePayload: (action, payload) => parseSimpleFusionPayload(action, payload) != null,
  uiConfig: OUTFIT_V1_UI_CONFIG,
};

const REGISTRY = new Map<string, VideoTemplateEngine>([
  [OUTFIT_V1_TEMPLATE_ID, OUTFIT_V1_ENGINE],
  [SIMPLE_FUSION_I2V_V1_TEMPLATE_ID, SIMPLE_FUSION_I2V_V1_ENGINE],
]);

export function registerVideoTemplateEngine(engine: VideoTemplateEngine): void {
  REGISTRY.set(engine.templateId, engine);
}

export function getVideoTemplateEngine(templateId: string): VideoTemplateEngine | null {
  return REGISTRY.get(templateId) ?? null;
}

export function listVideoTemplateEngines(): VideoTemplateEngine[] {
  return [...REGISTRY.values()];
}

export { OUTFIT_V1_ENGINE };
