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
      mode: z.enum(["script", "none"]).default("script"),
      burnIn: z.boolean().default(false),
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
      scaleMode: z.enum(["source", "fit1080p"]).default("fit1080p"),
    })
    .default({ scaleMode: "fit1080p" }),
});

export const mediaTimelineV1Schema = z.object({
  version: z.literal(1),
  clips: z.array(mediaClipSchema).min(1),
});

export type MediaClip = z.infer<typeof mediaClipSchema>;
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
