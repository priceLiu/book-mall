import type { WorkflowEnvelope } from "@/lib/video-workflow/envelope";
import { parseOutfitPayload } from "@/lib/video-workflow/templates/outfit-v1/schema";
import { parseOutfitV1Envelope } from "@/lib/video-workflow/templates/outfit-v1/parser";
import { OUTFIT_V1_UI_CONFIG } from "@/lib/video-workflow/templates/outfit-v1/ui-config";
import { OUTFIT_V1_TEMPLATE_ID } from "@/lib/video-workflow/templates/outfit-v1/constants";

export type VideoTemplateEngine = {
  templateId: string;
  displayName: string;
  moduleId: string;
  parseEnvelope: (envelope: WorkflowEnvelope) => ReturnType<typeof parseOutfitV1Envelope>;
  validatePayload: (action: string, payload: unknown) => boolean;
  uiConfig: typeof OUTFIT_V1_UI_CONFIG;
};

const OUTFIT_V1_ENGINE: VideoTemplateEngine = {
  templateId: OUTFIT_V1_TEMPLATE_ID,
  displayName: "穿搭视频",
  moduleId: "video-outfit",
  parseEnvelope: parseOutfitV1Envelope,
  validatePayload: (action, payload) => parseOutfitPayload(action, payload) != null,
  uiConfig: OUTFIT_V1_UI_CONFIG,
};

const REGISTRY = new Map<string, VideoTemplateEngine>([
  [OUTFIT_V1_TEMPLATE_ID, OUTFIT_V1_ENGINE],
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
