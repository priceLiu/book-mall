/**
 * 电商故事版 · KIE 多图参考成片入参
 */
import type { StoryboardReference } from "@/lib/ecom/ecom-storyboard-types";
import {
  getStoryboardCharacterRefs,
  getStoryboardProductRef,
  getStoryboardSceneRefs,
} from "@/lib/ecom/ecom-storyboard-refs";

function ensureKlingElementUrls(urls: string[]): string[] {
  const clean = urls.map((u) => u.trim()).filter((u) => /^https?:\/\//.test(u));
  if (clean.length === 0) return [];
  if (clean.length === 1) return [clean[0]!, clean[0]!];
  return clean.slice(0, 4);
}

/** Kling 3.0 · 首帧分镜图 + 最多 3 个 element（产品/角色/场景） */
export function buildEcomStoryboardKling30VideoInput(args: {
  prompt: string;
  firstFrameUrl: string;
  references: StoryboardReference[];
  aspectRatio: "16:9" | "9:16" | "1:1";
  durationSec: number;
  mode?: "std" | "pro";
  sound?: boolean;
}): { model: string; input: Record<string, unknown> } {
  const product = getStoryboardProductRef(args.references);
  const characters = getStoryboardCharacterRefs(args.references);
  const scenes = getStoryboardSceneRefs(args.references);

  const kling_elements: Array<{
    name: string;
    description: string;
    element_input_urls: string[];
  }> = [];

  if (product) {
    const urls = ensureKlingElementUrls([product.ossUrl]);
    if (urls.length) {
      kling_elements.push({
        name: "product",
        description: "e-commerce product packshot",
        element_input_urls: urls,
      });
    }
  }

  const charUrls = ensureKlingElementUrls(characters.map((c) => c.ossUrl));
  if (charUrls.length) {
    kling_elements.push({
      name: "characters",
      description: "main characters appearance and outfit",
      element_input_urls: charUrls,
    });
  }

  const sceneUrls = ensureKlingElementUrls(scenes.map((s) => s.ossUrl));
  if (sceneUrls.length) {
    kling_elements.push({
      name: "scene",
      description: "environment and lighting reference",
      element_input_urls: sceneUrls,
    });
  }

  const elementRefs = kling_elements.map((e) => `@${e.name}`).join(", ");
  const prompt = [
    args.prompt.trim(),
    elementRefs
      ? `Use storyboard first frame as shot layout. Reference elements: ${elementRefs}.`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const duration = Math.max(3, Math.min(15, Math.round(args.durationSec)));

  return {
    model: "kling-3.0/video",
    input: {
      prompt,
      image_urls: [args.firstFrameUrl.trim()],
      sound: args.sound !== false,
      duration: String(duration),
      aspect_ratio: args.aspectRatio,
      mode: args.mode ?? "pro",
      multi_shots: false,
      ...(kling_elements.length ? { kling_elements } : {}),
    },
  };
}
