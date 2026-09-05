import {
  SUBTITLE_FONT_KEYS,
  SUBTITLE_SIZE_KEYS,
} from "@private/media-render-subtitle-style/subtitle-style-options";
import { z } from "zod";

/** Media Render Timeline v1 — 与业务解耦的剪辑时间线 */
export const mediaClipSchema = z.object({
  order: z.number().int().nonnegative(),
  videoUrl: z.string().url(),
  audioUrl: z.string().url().optional(),
  subtitle: z.string().optional(),
  /** 可选；缺省由 ffprobe 探测 */
  durationSec: z.number().positive().optional(),
});

export const renderTransitionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("xfade"),
    durationSec: z.number().positive().max(3),
  }),
  z.object({
    type: z.literal("none"),
  }),
]);

export const renderProfileSchema = z.object({
  transition: renderTransitionSchema.default({ type: "xfade", durationSec: 0.6 }),
  subtitle: z
    .object({
      mode: z.enum(["script", "asr", "none"]).default("script"),
      burnIn: z.boolean().default(false),
      asrModelKey: z.string().optional(),
      /** burnIn 为 true 时生效；缺省等价 heiti + large */
      style: z
        .object({
          fontKey: z.enum(SUBTITLE_FONT_KEYS).default("heiti"),
          sizeKey: z.enum(SUBTITLE_SIZE_KEYS).default("large"),
          fontSize: z.number().min(6).max(36).optional(),
        })
        .optional(),
    })
    .default({ mode: "script", burnIn: false }),
  audio: z
    .object({
      bgmUrl: z.string().url().optional(),
      bgmVolume: z.number().min(0).max(1).optional(),
      mixTts: z.boolean().default(true),
    })
    .optional(),
  video: z
    .object({
      /** fit720p/fit1080p：按首镜比例缩放，长边封顶；不再 pad 成 16:9 */
      scaleMode: z
        .enum(["source", "fit720p", "fit1080p"])
        .default("fit1080p"),
    })
    .default({ scaleMode: "fit1080p" }),
});

/**
 * 画中画合成（我的 AI 空间 · 数字人口播）。
 *
 * 与默认「顺序多镜拼接」不同：`clips[0]` 作 **前景**（数字人口播视频），
 * 背景视频循环铺底、TTS 音轨可替换、字幕来自台词文本。
 */
export const compositeOverlaySchema = z.object({
  /** 前景相对背景宽度的比例 */
  scale: z.number().min(0.1).max(1).default(0.35),
  position: z
    .enum(["bottom-right", "bottom-left", "top-right", "top-left", "center"])
    .default("bottom-right"),
  marginPx: z.number().int().min(0).max(400).default(20),
  /** 小窗开始显示（秒，相对本段起点） */
  appearFromSec: z.number().min(0).optional(),
  /** 小窗结束显示（秒）；缺省 = 整段 */
  appearToSec: z.number().min(0).nullable().optional(),
});

export const mediaCompositeSchema = z.object({
  mode: z.literal("composite"),
  /** 背景视频；缺省则不叠底，仅做音轨替换与字幕烧录 */
  backgroundUrl: z.string().url().optional(),
  /** 覆盖音轨（口播 TTS）；缺省用前景自带音轨 */
  audioUrl: z.string().url().optional(),
  overlay: compositeOverlaySchema.default({
    scale: 0.35,
    position: "bottom-right",
    marginPx: 20,
  }),
  /** 烧录字幕文本（整段台词，按时长均分） */
  subtitleText: z.string().optional(),
});

export const mediaTimelineV1Schema = z.object({
  version: z.literal(1),
  clips: z.array(mediaClipSchema).min(1),
  /** 存在时走 composite 渲染路径，clips[0] 为前景 */
  composite: mediaCompositeSchema.optional(),
});

export type MediaClip = z.infer<typeof mediaClipSchema>;
export type MediaCompositeSpec = z.infer<typeof mediaCompositeSchema>;
export type CompositeOverlay = z.infer<typeof compositeOverlaySchema>;
export type RenderTransition = z.infer<typeof renderTransitionSchema>;
export type RenderProfile = z.infer<typeof renderProfileSchema>;
export type MediaTimelineV1 = z.infer<typeof mediaTimelineV1Schema>;

export const DEFAULT_RENDER_PROFILE: RenderProfile = {
  transition: { type: "xfade", durationSec: 0.6 },
  subtitle: { mode: "script", burnIn: false },
  video: { scaleMode: "fit1080p" },
};

export function parseMediaTimelineV1(raw: unknown): MediaTimelineV1 {
  return mediaTimelineV1Schema.parse(raw);
}

export function parseRenderProfile(raw: unknown): RenderProfile {
  if (raw == null || typeof raw !== "object") {
    return DEFAULT_RENDER_PROFILE;
  }
  return renderProfileSchema.parse(raw);
}
