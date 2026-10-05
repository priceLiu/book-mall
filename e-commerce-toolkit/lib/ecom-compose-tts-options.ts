import type { SimpleFusionPreviewSlot } from "@/lib/simple-fusion-preview-slots";
import type { SimpleFusionProject } from "@/lib/ecom-simple-fusion-video-api";
import type { ComposeWorkbenchClip } from "@/lib/simple-fusion-compose-workbench";
import type { SeedVideoShot } from "@/lib/seed-video-types";

/** 简易剪辑 · 可选的页面内已生成 TTS（按套装 / 分镜） */
export type EcomComposeTtsOption = {
  id: string;
  label: string;
  audioUrl: string;
  voiceover?: string;
  /** 推荐对齐的时间线视频段 id（如 look-{lookId}、shot-{index}） */
  suggestedClipId?: string;
  lookId?: string;
  shotIndex?: number;
};

function pushUniqueOption(
  out: EcomComposeTtsOption[],
  seen: Set<string>,
  opt: EcomComposeTtsOption,
) {
  const url = opt.audioUrl.trim();
  if (!url || seen.has(url)) return;
  seen.add(url);
  out.push({ ...opt, audioUrl: url });
}

/** 卡点跳舞 / 简单融合 · 各 look 上已生成的 TTS */
export function buildSimpleFusionComposeTtsOptions(
  project: SimpleFusionProject,
  slots: SimpleFusionPreviewSlot[],
  timelineClips: ComposeWorkbenchClip[] = [],
): EcomComposeTtsOption[] {
  const out: EcomComposeTtsOption[] = [];
  const seen = new Set<string>();
  const looks = project.meta?.looks ?? [];

  for (const look of looks) {
    const url = look.ttsUrl?.trim();
    if (!url) continue;
    const slot = slots.find((s) => s.key === look.lookId);
    const label = slot?.caption?.trim() || `套装 ${look.lookId.slice(0, 6)}`;
    pushUniqueOption(out, seen, {
      id: `look-${look.lookId}`,
      lookId: look.lookId,
      label,
      audioUrl: url,
      voiceover: look.voiceover?.trim(),
      suggestedClipId: `look-${look.lookId}`,
    });
  }

  for (const clip of timelineClips) {
    const url = clip.audioUrl?.trim();
    if (!url) continue;
    pushUniqueOption(out, seen, {
      id: `timeline-${clip.id}`,
      label: clip.label?.trim() || "时间线配音",
      audioUrl: url,
      voiceover: clip.subtitle?.trim(),
      suggestedClipId: clip.id,
      lookId: clip.lookId,
    });
  }

  return out;
}

/** 种草视频 / 拆图复刻 · 各镜已生成的 TTS */
export function buildSeedVideoComposeTtsOptions(
  shots: SeedVideoShot[],
): EcomComposeTtsOption[] {
  const out: EcomComposeTtsOption[] = [];
  const seen = new Set<string>();
  const sorted = [...shots].sort((a, b) => a.index - b.index);

  for (const shot of sorted) {
    const url = shot.ttsUrl?.trim();
    if (!url) continue;
    pushUniqueOption(out, seen, {
      id: `shot-${shot.index}`,
      shotIndex: shot.index,
      label: `镜 ${shot.index}${shot.timeSlice?.trim() ? ` · ${shot.timeSlice.trim()}` : ""}`,
      audioUrl: url,
      voiceover: shot.voiceover?.trim(),
      suggestedClipId: `shot-${shot.index}`,
    });
  }

  return out;
}
