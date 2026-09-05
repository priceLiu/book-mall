/**
 * 可灵 3.0 视频 · 百炼 DashScope 原生 API（非 KIE）
 * @see https://help.aliyun.com/zh/model-studio/kling-video-generation-api-reference/
 */

import type { StoryboardReference } from "@/lib/ecom/ecom-storyboard-types";
import {
  getStoryboardCharacterRefs,
  getStoryboardProductRef,
  getStoryboardSceneRefs,
} from "@/lib/ecom/ecom-storyboard-refs";

export const KLING_V3_VIDEO_MODEL = "kling/kling-v3-video-generation";
export const KLING_V3_OMNI_VIDEO_MODEL = "kling/kling-v3-omni-video-generation";

export const DASHSCOPE_KLING_V3_VIDEO_GATEWAY_KEYS = [
  "kling-3.0/video",
  "kling-3.0",
] as const;

export type DashscopeKlingAspectRatio = "16:9" | "9:16" | "1:1";
export type DashscopeKlingVideoMode = "std" | "pro" | "4k";

export type DashscopeKlingMediaItem = {
  type: "first_frame" | "last_frame" | "refer";
  url: string;
};

export function isDashscopeKlingV3VideoGatewayModel(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  return k === "kling-3.0/video" || k === "kling-3.0";
}

/** @deprecated 兼容旧名；可灵 3.0 视频已走百炼，不再经 KIE */
export function isStoryboardKling30KieVideoModel(modelKey: string): boolean {
  return isDashscopeKlingV3VideoGatewayModel(modelKey);
}

export function isDashscopeKlingV3UpstreamVideoModel(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  return (
    k.startsWith("kling/kling-v3") &&
    k.includes("video") &&
    !k.includes("image")
  );
}

export function resolveDashscopeKlingV3UpstreamModel(opts: {
  firstFrameUrl?: string | null;
  lastFrameUrl?: string | null;
  referImageUrls?: readonly string[];
  multiShot?: boolean;
}): string {
  const referCount = (opts.referImageUrls ?? []).filter((u) => u.trim()).length;
  if (referCount > 0 || opts.multiShot) {
    return KLING_V3_OMNI_VIDEO_MODEL;
  }
  return KLING_V3_VIDEO_MODEL;
}

export function buildDashscopeKlingV3VideoBody(opts: {
  prompt: string;
  firstFrameUrl?: string | null;
  lastFrameUrl?: string | null;
  referImageUrls?: string[];
  aspectRatio?: DashscopeKlingAspectRatio;
  durationSec?: number;
  mode?: DashscopeKlingVideoMode;
  audio?: boolean;
  watermark?: boolean;
  multiShot?: boolean;
}): { input: Record<string, unknown>; parameters: Record<string, unknown> } {
  const prompt = opts.prompt.trim();
  const duration = Math.max(3, Math.min(15, Math.round(opts.durationSec ?? 5)));
  const mode = opts.mode ?? "pro";
  const audio = opts.audio ?? false;
  const watermark = opts.watermark ?? false;
  const multiShot = opts.multiShot === true;

  const first = opts.firstFrameUrl?.trim() ?? "";
  const last = opts.lastFrameUrl?.trim() ?? "";
  const referUrls = (opts.referImageUrls ?? [])
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//.test(u));

  const media: DashscopeKlingMediaItem[] = [];
  if (first) media.push({ type: "first_frame", url: first });
  if (last && !multiShot) media.push({ type: "last_frame", url: last });
  for (const url of referUrls) {
    media.push({ type: "refer", url });
  }

  const input: Record<string, unknown> = { prompt };
  if (media.length) input.media = media;
  if (multiShot) input.multi_shot = true;

  const parameters: Record<string, unknown> = {
    mode,
    duration,
    audio,
    watermark,
  };

  const needsAspect =
    !first || referUrls.length > 0 || multiShot;
  if (needsAspect) {
    parameters.aspect_ratio = opts.aspectRatio ?? "16:9";
  }

  return { input, parameters };
}

function collectKlingReferUrls(references: StoryboardReference[]): string[] {
  const product = getStoryboardProductRef(references);
  const characters = getStoryboardCharacterRefs(references);
  const scenes = getStoryboardSceneRefs(references);
  const urls: string[] = [];
  if (product?.ossUrl?.trim()) urls.push(product.ossUrl.trim());
  for (const c of characters) {
    if (c.ossUrl?.trim()) urls.push(c.ossUrl.trim());
  }
  for (const s of scenes) {
    if (s.ossUrl?.trim()) urls.push(s.ossUrl.trim());
  }
  return [...new Set(urls)].slice(0, 7);
}

/** 电商分镜 · 可灵 3.0 首帧 + 产品/角色/场景参考图 */
export function buildEcomStoryboardKling30DashscopeVideoJob(args: {
  prompt: string;
  firstFrameUrl: string;
  references: StoryboardReference[];
  aspectRatio: DashscopeKlingAspectRatio;
  durationSec: number;
  mode?: "std" | "pro";
  sound?: boolean;
}): {
  model: string;
  videoBody: { input: Record<string, unknown>; parameters: Record<string, unknown> };
} {
  const referUrls = collectKlingReferUrls(args.references);
  const elementRefs = referUrls.length
    ? " Reference product, characters, and scene from attached refer images."
    : "";
  const prompt = `${args.prompt.trim()}${elementRefs}`.trim();

  const upstreamModel = resolveDashscopeKlingV3UpstreamModel({
    firstFrameUrl: args.firstFrameUrl,
    referImageUrls: referUrls,
  });
  const videoBody = buildDashscopeKlingV3VideoBody({
    prompt,
    firstFrameUrl: args.firstFrameUrl,
    referImageUrls: referUrls,
    aspectRatio: args.aspectRatio,
    durationSec: args.durationSec,
    mode: args.mode ?? "pro",
    audio: args.sound !== false,
  });

  return { model: upstreamModel, videoBody };
}
