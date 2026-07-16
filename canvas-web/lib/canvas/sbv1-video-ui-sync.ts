import { GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID } from "@/lib/canvas/system-providers";
import {
  SBV1_ASPECT_RATIOS,
  sbv1AspectRatioLabel,
} from "@/lib/canvas/sbv1-video-models";
import {
  clampSbv1ReferenceMode,
  getSbv1VideoModelRefCaps,
} from "@/lib/canvas/sbv1-video-model-reference";
import type {
  Sbv1AspectRatio,
  Sbv1ReferenceMode,
  Sbv1VideoEngineNodeData,
} from "@/lib/canvas/sbv1-workspace-types";

export function normalizeSbv1EngineProviderId(id: string | undefined): string {
  const trimmed = id?.trim() ?? "";
  if (!trimmed || trimmed === "gateway:volcengine") {
    return GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID;
  }
  return trimmed;
}

export function isSbv1MotionControlModelKey(k: string): boolean {
  return k === "kling-2.6/motion-control" || k === "kling-3.0/motion-control";
}

export function syncSbv1UiFromModelParams(
  modelKey: string,
  p: Record<string, unknown>,
  setters: {
    setAspectRatio: (v: Sbv1AspectRatio) => void;
    setDurationSec: (v: number) => void;
    setResolution: (v: "720p" | "1080p") => void;
    setGenerateAudio: (v: boolean) => void;
    setReferenceMode: (v: Sbv1ReferenceMode) => void;
    providerId?: string;
    currentReferenceMode?: Sbv1ReferenceMode;
  },
) {
  const res = p.resolution;
  if (typeof res === "string") {
    const rl = res.toLowerCase();
    if (rl === "720p" || rl === "1080p") setters.setResolution(rl);
  }
  const dur = Number(p.duration);
  if (Number.isFinite(dur) && dur >= 3 && dur <= 15) {
    setters.setDurationSec(Math.round(dur));
  }
  const ar = p.aspect_ratio ?? p.ratio;
  if (
    typeof ar === "string" &&
    (SBV1_ASPECT_RATIOS as readonly string[]).includes(ar)
  ) {
    setters.setAspectRatio(ar as Sbv1AspectRatio);
  }
  const audio = p.generate_audio ?? p.generateAudio ?? p.sound;
  if (audio !== undefined) setters.setGenerateAudio(audio !== false);
  if (isSbv1MotionControlModelKey(modelKey)) {
    setters.setReferenceMode("omni");
  }
  const caps = getSbv1VideoModelRefCaps(modelKey, {
    multiShots: p.multi_shots === true,
    providerId: setters.providerId,
  });
  if (p.multi_shots === true && caps.multiShotsBlocksFirstLast) {
    setters.setReferenceMode("omni");
  }
  if (setters.currentReferenceMode) {
    setters.setReferenceMode(
      clampSbv1ReferenceMode(setters.currentReferenceMode, caps),
    );
  }
}

/** Dock 摘要 · 从 engine.params 解析比例/时长/分辨率（Gateway 模型参数与顶层字段对齐） */
export function resolveSbv1VideoDockDisplayFields(
  data: Sbv1VideoEngineNodeData,
): {
  aspectRatio: Sbv1AspectRatio;
  durationSec: number;
  resolution: Sbv1VideoEngineNodeData["resolution"];
} {
  const p = data.engine?.params ?? {};
  const modelKey = data.engine?.modelKey ?? "";
  let aspectRatio = data.aspectRatio;
  let durationSec = data.durationSec;
  let resolution = data.resolution;
  syncSbv1UiFromModelParams(modelKey, p, {
    setAspectRatio: (v) => {
      aspectRatio = v;
    },
    setDurationSec: (v) => {
      durationSec = v;
    },
    setResolution: (v) => {
      resolution = v;
    },
    setGenerateAudio: () => {},
    setReferenceMode: () => {},
    providerId: normalizeSbv1EngineProviderId(data.engine?.providerId),
  });
  return { aspectRatio, durationSec, resolution };
}

/** Dock 底栏 · 参数触发钮文案 */
export function sbv1VideoParamsTriggerLabel(data: Sbv1VideoEngineNodeData): string {
  if (!data.engine?.modelKey?.trim()) return "参数";
  const { aspectRatio, durationSec, resolution } =
    resolveSbv1VideoDockDisplayFields(data);
  const parts: string[] = [sbv1AspectRatioLabel(aspectRatio)];
  if (resolution) parts.push(resolution.toUpperCase());
  if (data.referenceMode === "smart_multi") {
    parts.push("智能多帧");
  } else if (durationSec >= 4 && durationSec <= 15) {
    parts.push(`${durationSec}s`);
  }
  return parts.join(" · ");
}
