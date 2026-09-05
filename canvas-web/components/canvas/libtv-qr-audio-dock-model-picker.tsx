"use client";

import { ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { fetchLibtvQrAudioCatalog } from "@/lib/canvas/libtv-qr-audio-catalog-client";
import {
  buildQrVoiceoverEnginePick,
  isQrVoiceoverModel,
  type LibtvQrAudioCatalogModel,
} from "@/lib/canvas/libtv-qr-audio-models";
import { useLibtvDockToolbarMetrics } from "@/lib/canvas/use-libtv-dock-toolbar-metrics";
import { cn } from "@/lib/utils";
import {
  Sbv1ToolbarDropdown,
  useSbv1ToolbarAnchor,
} from "./sbv1/sbv1-toolbar-anchor-popover";
import { LIBTV_DOCK_MODEL_POPOVER_CLASS } from "./libtv-dock-picker-chrome";

export function libtvQrAudioModelTriggerLabel(
  modelKey: string,
  models: LibtvQrAudioCatalogModel[],
): string {
  const key = modelKey.trim();
  if (!key) return "选择模型";
  return models.find((m) => m.modelKey === key)?.label ?? key;
}

/** 音频 Dock · 快速复制旁白模型（MiniMax Speech / ElevenLabs TTS） */
export function LibtvQrAudioDockModelPicker({
  modelKey,
  voiceId,
  disabled,
  open: controlledOpen,
  onOpenChange,
  onChange,
}: {
  modelKey: string;
  voiceId?: string;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onChange: (next: {
    providerId: string;
    modelKey: string;
    params: Record<string, unknown>;
  }) => void;
}) {
  const base = useBookMallBaseUrl();
  const { anchorRef, open: internalOpen, setOpen: setInternalOpen, rect } =
    useSbv1ToolbarAnchor(controlledOpen);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const { fontPx, minHeightPx, chevronPx } = useLibtvDockToolbarMetrics();

  const [models, setModels] = useState<LibtvQrAudioCatalogModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const voiceoverModels = useMemo(
    () => models.filter(isQrVoiceoverModel),
    [models],
  );
  const label = libtvQrAudioModelTriggerLabel(modelKey, voiceoverModels);

  useEffect(() => {
    if (!open || !base) return;
    setLoading(true);
    setError(null);
    void fetchLibtvQrAudioCatalog(base)
      .then((catalog) => setModels(catalog.models ?? []))
      .catch((e) => {
        setError(e instanceof Error ? e.message : "加载模型失败");
        setModels([]);
      })
      .finally(() => setLoading(false));
  }, [open, base]);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled}
        title={label}
        className="nodrag flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-2 text-white hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
        style={{ fontSize: fontPx, minHeight: minHeightPx }}
        onClick={() => setOpen(!open)}
      >
        <span className="whitespace-nowrap">{label}</span>
        <ChevronDown
          className="shrink-0 opacity-45"
          style={{ width: chevronPx, height: chevronPx }}
        />
      </button>
      <Sbv1ToolbarDropdown
        open={open}
        setOpen={setOpen}
        rect={rect}
        placement="auto"
        estimatedHeight={360}
        className={LIBTV_DOCK_MODEL_POPOVER_CLASS}
      >
        <div className="max-h-[320px] overflow-y-auto px-1 pb-1">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-white/45">
              <Loader2 className="size-3.5 animate-spin" />
              加载模型…
            </div>
          ) : null}
          {error ? (
            <p className="px-2 py-3 text-[12px] text-red-300">{error}</p>
          ) : null}
          {!loading && !error
            ? voiceoverModels.map((model) => {
                const active = modelKey.trim() === model.modelKey;
                return (
                  <button
                    key={model.modelKey}
                    type="button"
                    className={cn(
                      "flex w-full flex-col rounded-md px-2.5 py-2 text-left transition",
                      active
                        ? "bg-white/[0.12] text-white"
                        : "text-white/75 hover:bg-white/[0.06]",
                    )}
                    onClick={() => {
                      const pick = buildQrVoiceoverEnginePick(model, { voiceId });
                      onChange({
                        providerId: pick.providerId,
                        modelKey: pick.modelKey,
                        params: pick.params ?? {},
                      });
                      setOpen(false);
                    }}
                  >
                    <span className="truncate text-[13px] font-medium">
                      {model.label}
                    </span>
                    <span className="truncate text-[11px] text-white/45">
                      {model.subtitle} ·{" "}
                      {model.provider === "elevenlabs" ? "ElevenLabs" : "MiniMax"}
                    </span>
                  </button>
                );
              })
            : null}
        </div>
      </Sbv1ToolbarDropdown>
    </>
  );
}
