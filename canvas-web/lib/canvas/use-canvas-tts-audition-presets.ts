"use client";

import { useCallback, useMemo } from "react";

import { libtvTtsParamsTriggerLabel } from "@/components/canvas/libtv-audio-dock-pickers";
import {
  buildTtsAuditionPresetId,
  buildTtsAuditionPresetLabels,
  normalizeTtsAuditionPresetParams,
  readCanvasTtsAuditionPresets,
  upsertCanvasTtsAuditionPreset,
  type CanvasTtsAuditionPreset,
} from "@/lib/canvas/libtv-tts-audition-presets";
import { useCanvasStore } from "@/lib/canvas/store";

export function useCanvasTtsAuditionPresets(variant: "minimax" | "qwen") {
  const graphMeta = useCanvasStore((s) => s.graphMeta);
  const patchGraphMeta = useCanvasStore((s) => s.patchGraphMeta);

  const allPresets = useMemo(
    () => readCanvasTtsAuditionPresets(graphMeta),
    [graphMeta],
  );

  const presets = useMemo(
    () => allPresets.filter((row) => row.variant === variant),
    [allPresets, variant],
  );

  const upsertFromSynth = useCallback(
    (args: {
      variant: "minimax" | "qwen";
      providerId: string;
      modelKey: string;
      voiceId: string;
      voiceLabel: string;
      params: Record<string, unknown>;
      previewUrl: string;
      sampleText?: string;
      language?: string;
      subtitle?: string;
      sourceNodeId?: string;
    }) => {
      const modelKey = args.modelKey.trim();
      const voiceId = args.voiceId.trim();
      const previewUrl = args.previewUrl.trim();
      if (!modelKey || !voiceId || !previewUrl) return;

      const normalizedParams = normalizeTtsAuditionPresetParams(args.params);
      const id = buildTtsAuditionPresetId({
        modelKey,
        voiceId,
        params: normalizedParams,
      });
      const labels = buildTtsAuditionPresetLabels({
        voiceLabel: args.voiceLabel,
        paramHint: libtvTtsParamsTriggerLabel(normalizedParams),
        subtitle: args.subtitle,
      });
      const preset: CanvasTtsAuditionPreset = {
        id,
        label: labels.label,
        subtitle: labels.subtitle,
        variant: args.variant,
        providerId: args.providerId.trim(),
        modelKey,
        voiceId,
        voiceLabel: args.voiceLabel.trim() || voiceId,
        params: normalizedParams,
        sampleText: args.sampleText?.trim() || undefined,
        language: args.language?.trim() || undefined,
        previewUrl,
        createdAt: new Date().toISOString(),
        sourceNodeId: args.sourceNodeId?.trim() || undefined,
      };

      patchGraphMeta((meta) => ({
        ...(meta ?? {}),
        ttsAuditionPresets: upsertCanvasTtsAuditionPreset(
          readCanvasTtsAuditionPresets(meta),
          preset,
        ),
      }));
    },
    [patchGraphMeta],
  );

  return { presets, allPresets, upsertFromSynth };
}
