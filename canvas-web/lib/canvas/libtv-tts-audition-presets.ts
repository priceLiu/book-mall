import { LIBTV_TTS_PARAM_PREVIEW_BILLING_KEY } from "@/lib/canvas/libtv-tts-preview-client";
import type { ExportProjectAssetDraft } from "@/lib/canvas/project-asset-export";

/** 画布 meta · 调参试听成功后冻结的 TTS 参考音色（全项目音频节点共用） */
export type CanvasTtsAuditionPreset = {
  id: string;
  label: string;
  subtitle?: string;
  variant: "minimax" | "qwen";
  providerId: string;
  modelKey: string;
  voiceId: string;
  voiceLabel: string;
  params: Record<string, unknown>;
  sampleText?: string;
  language?: string;
  previewUrl: string;
  createdAt: string;
  sourceNodeId?: string;
};

export const LIBTV_TTS_AUDITION_PRESETS_MAX = 32;

export function normalizeTtsAuditionPresetParams(
  params: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...params };
  delete out[LIBTV_TTS_PARAM_PREVIEW_BILLING_KEY];
  delete out.voice_id;
  delete out.voice;
  delete out.voice_label;
  return out;
}

function stableJson(value: unknown): string {
  if (value == null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableJson(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(obj[k])}`).join(",")}}`;
}

/** 同一 model + voice + params 视为同一条预设 */
export function buildTtsAuditionPresetId(args: {
  modelKey: string;
  voiceId: string;
  params: Record<string, unknown>;
}): string {
  const payload = stableJson({
    modelKey: args.modelKey.trim(),
    voiceId: args.voiceId.trim(),
    params: normalizeTtsAuditionPresetParams(args.params),
  });
  let hash = 5381;
  for (let i = 0; i < payload.length; i += 1) {
    hash = (hash * 33) ^ payload.charCodeAt(i);
  }
  return `tts-ap-${(hash >>> 0).toString(36)}`;
}

export function buildTtsAuditionPresetLabels(args: {
  voiceLabel: string;
  paramHint?: string;
  subtitle?: string;
}): { label: string; subtitle?: string } {
  const voice = args.voiceLabel.trim();
  const paramHint = args.paramHint?.trim();
  const label =
    paramHint && paramHint !== "参数" && voice
      ? `${voice} · ${paramHint}`
      : voice || paramHint || "参考音色";
  return {
    label,
    subtitle: args.subtitle?.trim() || undefined,
  };
}

export function upsertCanvasTtsAuditionPreset(
  prev: CanvasTtsAuditionPreset[],
  item: CanvasTtsAuditionPreset,
): CanvasTtsAuditionPreset[] {
  const id = item.id.trim();
  if (!id) return prev;
  return [
    item,
    ...prev.filter((row) => row.id !== id),
  ].slice(0, LIBTV_TTS_AUDITION_PRESETS_MAX);
}

export function engineFromTtsAuditionPreset(
  preset: CanvasTtsAuditionPreset,
): {
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
} {
  return {
    providerId: preset.providerId,
    modelKey: preset.modelKey,
    params: paramsFromTtsAuditionPreset(preset),
  };
}

export function paramsFromTtsAuditionPreset(
  preset: CanvasTtsAuditionPreset,
): Record<string, unknown> {
  const base = normalizeTtsAuditionPresetParams(preset.params);
  if (preset.variant === "qwen") {
    return { ...base, voice: preset.voiceId };
  }
  return {
    ...base,
    voice_id: preset.voiceId,
    voice_label: preset.voiceLabel,
  };
}

export function isActiveTtsAuditionPreset(
  preset: CanvasTtsAuditionPreset,
  args: {
    variant: "minimax" | "qwen";
    providerId: string;
    modelKey: string;
    voiceId: string;
    params: Record<string, unknown>;
  },
): boolean {
  if (preset.variant !== args.variant) return false;
  return (
    preset.id ===
    buildTtsAuditionPresetId({
      modelKey: args.modelKey,
      voiceId: args.voiceId,
      params: args.params,
    })
  );
}

/** 已试听参考音色 → 项目资产「我的音色」草稿 */
export function exportTtsAuditionPresetToProjectAssetDraft(args: {
  preset: CanvasTtsAuditionPreset;
  projectId: string;
  edition: "pro" | "pro2" | "sbv1" | "standard";
}): ExportProjectAssetDraft {
  const { preset, projectId, edition } = args;
  const previewUrl = preset.previewUrl.trim();
  const engine = engineFromTtsAuditionPreset(preset);
  const isHttpPreview = previewUrl.startsWith("https://") || previewUrl.startsWith("http://");

  return {
    kind: "AUDIO",
    displayName: preset.label.trim() || preset.voiceLabel || "我的音色",
    description: preset.subtitle?.trim() || preset.voiceLabel || "",
    thumbnailUrl: isHttpPreview ? previewUrl : "",
    sourceProjectId: projectId,
    sourceNodeId: preset.sourceNodeId ?? "",
    sourceEdition: edition,
    payload: {
      assetSubtype: "tts_voice_preset",
      variant: preset.variant,
      providerId: preset.providerId,
      modelKey: preset.modelKey,
      voiceId: preset.voiceId,
      voiceLabel: preset.voiceLabel,
      params: normalizeTtsAuditionPresetParams(preset.params),
      previewUrl,
      sampleText: preset.sampleText,
      language: preset.language,
      nodeType: "story-pro2-audio",
      engine,
      nodeSnapshot: {
        label: preset.label,
        dockInput: preset.sampleText ?? "",
        engine,
      },
    },
    refs: isHttpPreview
      ? [
          {
            slotKey: "preview",
            label: "试听",
            mediaUrl: previewUrl,
            mimeType: "audio/mpeg",
          },
        ]
      : [],
  };
}

export function readCanvasTtsAuditionPresets(
  meta: { ttsAuditionPresets?: CanvasTtsAuditionPreset[] } | null | undefined,
): CanvasTtsAuditionPreset[] {
  const rows = meta?.ttsAuditionPresets;
  if (!Array.isArray(rows)) return [];
  return rows.filter(
    (row) =>
      row &&
      typeof row.id === "string" &&
      typeof row.voiceId === "string" &&
      typeof row.previewUrl === "string" &&
      row.previewUrl.trim(),
  );
}
