import { STORY_FRAME_IMAGE_PROMPT_DEFAULT } from "./story-prompts";

/** NodePalette 拖入/点击「分镜图」时的 image-engine 初始 data */
export function buildImageEngineDataFromPreset(
  presetId: string,
): Record<string, unknown> | undefined {
  if (presetId !== "story-frame") return undefined;
  return {
    prompt: STORY_FRAME_IMAGE_PROMPT_DEFAULT,
    storyFrameMode: true,
    params: {
      aspect_ratio: "16:9",
      resolution: "2K",
      output_format: "png",
    },
  };
}
