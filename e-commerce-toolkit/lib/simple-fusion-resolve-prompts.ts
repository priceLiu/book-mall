import type { SimpleFusionProject } from "@/lib/ecom-simple-fusion-video-api";
import { buildSimpleFusionAutoPrompts } from "@/lib/simple-fusion-auto-prompts";
import { buildSimpleFusionAutoVideoPrompt } from "@/lib/simple-fusion-auto-video-prompt";
import {
  SIMPLE_FUSION_PROMPT_BODIES,
  moduleToVariant,
} from "@/lib/simple-fusion-default-prompts";
import { buildSimpleFusionPreviewSlots } from "@/lib/simple-fusion-preview-slots";

export function resolveSimpleFusionPromptsForProject(
  project: SimpleFusionProject,
  opts: { garmentMulti: boolean },
): { fusion: string; video: string; negative: string } {
  const variant = moduleToVariant(project.module);
  const slots = buildSimpleFusionPreviewSlots(project, opts);
  const autoFusion = buildSimpleFusionAutoPrompts(variant, project.references);
  const autoVideo = buildSimpleFusionAutoVideoPrompt(variant, slots);
  const user = project.meta?.prompts ?? {};

  const fusion =
    project.meta?.promptsCustomized === true
      ? user.fusion?.trim() || autoFusion.fusion
      : autoFusion.fusion;

  const video =
    project.meta?.videoPromptCustomized === true
      ? user.video?.trim() || autoVideo
      : autoVideo;

  const negative =
    user.negative?.trim() || autoFusion.negative;

  return { fusion, video, negative };
}

export function simpleFusionAutoPromptsSnapshot(
  project: SimpleFusionProject,
  opts: { garmentMulti: boolean },
) {
  const variant = moduleToVariant(project.module);
  const slots = buildSimpleFusionPreviewSlots(project, opts);
  return {
    fusion: buildSimpleFusionAutoPrompts(variant, project.references),
    video: buildSimpleFusionAutoVideoPrompt(variant, slots),
    bodies: SIMPLE_FUSION_PROMPT_BODIES[variant],
  };
}
