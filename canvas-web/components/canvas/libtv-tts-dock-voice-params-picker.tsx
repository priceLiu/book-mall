"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  libtvTtsParamsTriggerLabel,
  LibtvTtsDockParamsPopoverContent,
} from "@/components/canvas/libtv-audio-dock-pickers";
import {
  LIBTV_DOCK_VOICE_TRIGGER_MAX_WIDTH_CLASS,
  resolveLibtvDockVoiceFullLabel,
} from "@/lib/canvas/libtv-tts-voice-preference";
import {
  isLibtvTtsParamPreviewBillingEnabled,
  LIBTV_TTS_PARAM_PREVIEW_BILLING_KEY,
  type LibtvTtsPreviewContext,
  type LibtvTtsRowPreviewSpec,
} from "@/lib/canvas/libtv-tts-preview-client";
import {
  libtvTtsVoiceTriggerLabel,
  useLibtvMinimaxVoiceCatalog,
} from "@/lib/canvas/use-libtv-minimax-voice-catalog";
import {
  QWEN3_TTS_FLASH_VOICES,
  qwen3TtsVoiceLabel,
} from "@/lib/canvas/qwen3-tts-voice-catalog";
import type { CanvasProviderDto } from "@/lib/canvas-providers-api";
import { useLibtvDockToolbarMetrics } from "@/lib/canvas/use-libtv-dock-toolbar-metrics";
import {
  upsertLibtvTtsAuditionHistory,
  type LibtvTtsAuditionHistoryItem,
} from "@/lib/canvas/libtv-tts-audition-history";
import { cn } from "@/lib/utils";
import { LIBTV_DOCK_PARAMS_POPOVER_CLASS } from "./libtv-dock-picker-chrome";
import { LibtvMinimaxVoiceCatalogList } from "./libtv-minimax-voice-catalog-list";
import {
  Sbv1ToolbarDropdown,
  useSbv1ToolbarAnchor,
} from "./sbv1/sbv1-toolbar-anchor-popover";
import { LibtvVoicePreviewButton } from "./libtv-voice-preview-button";
import { LibtvVoiceSelectList } from "./libtv-voice-select-list";

export function libtvTtsVoiceParamsTriggerLabel(
  voiceLabel: string,
  params: Record<string, unknown>,
): string {
  const voice = voiceLabel.trim();
  const paramHint = libtvTtsParamsTriggerLabel(params);
  if (!voice) return paramHint === "参数" ? "音色与参数" : paramHint;
  if (paramHint === "参数") return voice;
  return `${voice} · ${paramHint}`;
}

/** TTS · 音色 + 参数 · 单一 Popover（参数/试听逻辑与合并前 LibtvTtsDockParamsPicker 一致） */
export function LibtvTtsDockVoiceParamsPicker({
  variant,
  voiceId,
  savedLabel,
  providerId,
  modelKey,
  params,
  previewContext,
  externalProviders,
  disabled,
  open: controlledOpen,
  onOpenChange,
  onSelectVoice,
  onChangeParams,
}: {
  variant: "minimax" | "qwen";
  voiceId: string;
  savedLabel?: string;
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
  previewContext?: LibtvTtsPreviewContext;
  externalProviders?: CanvasProviderDto[];
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelectVoice: (voiceId: string, label: string) => void;
  onChangeParams: (params: Record<string, unknown>) => void;
}) {
  const { anchorRef, open: internalOpen, setOpen: setInternalOpen, rect } =
    useSbv1ToolbarAnchor(controlledOpen);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const { fontPx, minHeightPx, chevronPx } = useLibtvDockToolbarMetrics();

  const { merged } = useLibtvMinimaxVoiceCatalog(
    open && variant === "minimax",
  );

  const resolvedVoiceId = String(
    voiceId ?? params.voice_id ?? params.voice ?? "",
  ).trim();

  const voiceDisplayLabel = useMemo(() => {
    if (variant === "minimax") {
      return libtvTtsVoiceTriggerLabel(resolvedVoiceId, merged, savedLabel);
    }
    return resolveLibtvDockVoiceFullLabel({
      voiceId: resolvedVoiceId,
      savedLabel,
      catalogLabel: qwen3TtsVoiceLabel(resolvedVoiceId),
    });
  }, [variant, resolvedVoiceId, merged, savedLabel]);

  const triggerLabel = libtvTtsVoiceParamsTriggerLabel(
    voiceDisplayLabel,
    params,
  );

  const qwenVoiceOptions = useMemo(
    () =>
      QWEN3_TTS_FLASH_VOICES.map((v) => ({
        value: v.id,
        label: v.label,
      })),
    [],
  );

  const hasModel = Boolean(modelKey.trim());

  const [billingPreviewEnabled, setBillingPreviewEnabled] = useState(() =>
    isLibtvTtsParamPreviewBillingEnabled(params),
  );
  const [auditionHistory, setAuditionHistory] = useState<
    LibtvTtsAuditionHistoryItem[]
  >([]);

  useEffect(() => {
    if (open) {
      setBillingPreviewEnabled(isLibtvTtsParamPreviewBillingEnabled(params));
    }
    // 只在弹层打开时同步一次，避免改语速等把勾选状态冲掉
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅跟随 open
  }, [open]);

  const rowPreviewActive = billingPreviewEnabled;

  const rowPreviewSpec = useMemo((): LibtvTtsRowPreviewSpec | undefined => {
    const key = String(previewContext?.modelKey ?? modelKey ?? "").trim();
    if (!rowPreviewActive || !key) return undefined;
    return {
      modelKey: key,
      projectId: previewContext?.projectId,
      dockParams: params,
    };
  }, [rowPreviewActive, previewContext?.modelKey, previewContext?.projectId, modelKey, params]);

  const handleParamsChange = (next: Record<string, unknown>) => {
    if (
      Object.prototype.hasOwnProperty.call(
        next,
        LIBTV_TTS_PARAM_PREVIEW_BILLING_KEY,
      )
    ) {
      setBillingPreviewEnabled(isLibtvTtsParamPreviewBillingEnabled(next));
    }
    onChangeParams(next);
  };

  const handleSynthPlayed = useCallback(
    (info: { voiceId: string; dataUrl: string }) => {
      const id = info.voiceId.trim();
      if (!id) return;
      const catalogHit =
        variant === "minimax"
          ? merged.find((v) => v.voiceId === id)
          : undefined;
      const qwenHit =
        variant === "qwen"
          ? qwenVoiceOptions.find((v) => v.value === id)
          : undefined;
      setAuditionHistory((prev) =>
        upsertLibtvTtsAuditionHistory(prev, {
          voiceId: id,
          label:
            catalogHit?.label?.trim() ||
            qwenHit?.label?.trim() ||
            id,
          subtitle: catalogHit?.subtitle ?? catalogHit?.language,
          sampleText: catalogHit?.sampleText,
          language: catalogHit?.language,
          dataUrl: info.dataUrl,
        }),
      );
    },
    [merged, qwenVoiceOptions, variant],
  );

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled || !hasModel}
        title={hasModel ? triggerLabel : "请先选择模型"}
        className="nodrag flex max-w-[12rem] shrink-0 items-center gap-1.5 rounded-md px-2.5 py-2 text-white hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
        style={{ fontSize: fontPx, minHeight: minHeightPx }}
        onClick={() => setOpen(!open)}
      >
        <SlidersHorizontal className="size-3.5 shrink-0 text-white/55" />
        <span
          className={`min-w-0 truncate whitespace-nowrap ${LIBTV_DOCK_VOICE_TRIGGER_MAX_WIDTH_CLASS}`}
        >
          {hasModel ? triggerLabel : "音色与参数"}
        </span>
        <ChevronDown
          className="shrink-0 opacity-45"
          style={{ width: chevronPx, height: chevronPx }}
        />
      </button>
      <Sbv1ToolbarDropdown
        open={open && hasModel}
        setOpen={setOpen}
        rect={rect}
        placement="auto"
        estimatedHeight={520}
        containScroll
        fillHeight
        className={cn(
          LIBTV_DOCK_PARAMS_POPOVER_CLASS,
          "flex min-h-0 flex-col overflow-hidden py-1.5",
        )}
      >
        <div className="nodrag nowheel flex min-h-0 flex-1 flex-col">
          <p className="shrink-0 px-2 pb-0.5 pt-0.5 text-[10px] text-white/40">
            音色
          </p>
          <div className="min-h-[7.5rem] flex-1 overflow-hidden">
            {variant === "minimax" ? (
              <LibtvMinimaxVoiceCatalogList
                active={open}
                voiceId={resolvedVoiceId}
                disabled={disabled}
                listKey="unified-minimax-voice"
                className="h-full"
                maxHeightClass="min-h-0 flex-1"
                rowPreviewSpec={rowPreviewSpec}
                onSelectVoice={onSelectVoice}
                onSynthPlayed={handleSynthPlayed}
              />
            ) : (
              <LibtvVoiceSelectList
                key="unified-qwen-voice"
                options={qwenVoiceOptions}
                value={resolvedVoiceId || "Cherry"}
                pageSize={10}
                maxHeightClass="h-full min-h-0"
                minimaxOssFallback={false}
                rowPreviewSpec={rowPreviewSpec}
                fallbackPreviewContext={previewContext}
                onSynthPlayed={handleSynthPlayed}
                onSelect={(nextVoiceId) => {
                  const hit = qwenVoiceOptions.find((o) => o.value === nextVoiceId);
                  onSelectVoice(nextVoiceId, hit?.label?.trim() || nextVoiceId);
                }}
              />
            )}
          </div>

          <div className="min-h-0 shrink overflow-y-auto overscroll-contain">
            <LibtvTtsDockParamsPopoverContent
              providerId={providerId}
              modelKey={modelKey}
              params={params}
              externalProviders={externalProviders}
              onChange={handleParamsChange}
              onBillingPreviewChange={setBillingPreviewEnabled}
            />
            {auditionHistory.length > 0 ? (
              <div className="border-t border-white/10 px-0.5 pb-1 pt-1">
                <p className="px-2 pb-0.5 text-[10px] text-white/40">已试听</p>
                <div className="max-h-[7.5rem] overflow-y-auto overscroll-contain">
                  {auditionHistory.map((item) => (
                    <div
                      key={item.voiceId}
                      className={cn(
                        "flex items-center gap-1 rounded-md pr-1 transition",
                        resolvedVoiceId === item.voiceId
                          ? "bg-white/[0.12]"
                          : "hover:bg-white/[0.06]",
                      )}
                    >
                      <button
                        type="button"
                        className={cn(
                          "flex min-w-0 flex-1 flex-col px-2 py-1 text-left leading-tight",
                          resolvedVoiceId === item.voiceId
                            ? "text-white"
                            : "text-white/75",
                        )}
                        onClick={() => onSelectVoice(item.voiceId, item.label)}
                      >
                        <span className="truncate text-[12px] font-medium">
                          {item.label}
                        </span>
                        {item.subtitle ? (
                          <span className="truncate text-[10px] text-white/40">
                            {item.subtitle}
                          </span>
                        ) : null}
                      </button>
                      <LibtvVoicePreviewButton
                        previewUrl={item.dataUrl}
                        voiceId={item.voiceId}
                        voiceLanguage={item.language}
                        sampleText={item.sampleText}
                        minimaxOssFallback={false}
                        mode="oss"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </Sbv1ToolbarDropdown>
    </>
  );
}
