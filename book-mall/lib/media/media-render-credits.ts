import type { RenderProfile } from "@/lib/media/timeline-types";
import {
  consumeCredits,
  refundCredits,
  type AccountRef,
} from "@/lib/billing/credit-account-service";

/** 自动成片 · 固定扣费（与 ASR 厂商按秒价无关，含 FFmpeg 合片平台算力） */
export const MEDIA_RENDER_BASE_CREDITS = 20;

/** 烧录字幕 · ASR 识别附加（含 Gateway 调用，不再对 ASR 日志二次扣积分） */
export const MEDIA_RENDER_ASR_SURCHARGE_CREDITS = 10;

/** Gateway ASR 日志 clientPage · 结算时跳过（费用已含在 job 附加分内） */
export const MEDIA_RENDER_ASR_CLIENT_PAGE = "media-render-asr";

export function usesMediaRenderAsr(profile: RenderProfile): boolean {
  return Boolean(profile.subtitle.burnIn && profile.subtitle.mode === "asr");
}

export function computeMediaRenderCredits(profile: RenderProfile): number {
  return (
    MEDIA_RENDER_BASE_CREDITS +
    (usesMediaRenderAsr(profile) ? MEDIA_RENDER_ASR_SURCHARGE_CREDITS : 0)
  );
}

export async function chargeMediaRenderJobCredits(args: {
  ref: AccountRef;
  jobId: string;
  profile: RenderProfile;
  actorUserId?: string;
}): Promise<number> {
  const credits = computeMediaRenderCredits(args.profile);
  if (credits <= 0) return 0;
  await consumeCredits({
    ref: args.ref,
    credits,
    actorUserId: args.actorUserId,
    idempotencyKey: `media_render:${args.jobId}`,
    description: usesMediaRenderAsr(args.profile)
      ? `自动成片（含 ASR）· ${credits} 积分`
      : `自动成片 · ${credits} 积分`,
  });
  return credits;
}

export async function refundMediaRenderJobCredits(args: {
  ref: AccountRef;
  jobId: string;
  profile: RenderProfile;
}): Promise<void> {
  const credits = computeMediaRenderCredits(args.profile);
  if (credits <= 0) return;
  await refundCredits({
    ref: args.ref,
    credits,
    idempotencyKey: `refund:media_render:${args.jobId}`,
    description: "自动成片失败/中止返还",
  });
}
