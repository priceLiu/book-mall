"use client";

import { ChevronDown } from "lucide-react";
import { useMemo } from "react";

import { useLibtvDockToolbarMetrics } from "@/lib/canvas/use-libtv-dock-toolbar-metrics";
import {
  QWEN3_TTS_FLASH_VOICES,
  qwen3TtsVoiceLabel,
} from "@/lib/canvas/qwen3-tts-voice-catalog";
import {
  LIBTV_DOCK_VOICE_TRIGGER_MAX_WIDTH_CLASS,
  resolveLibtvDockVoiceFullLabel,
} from "@/lib/canvas/libtv-tts-voice-preference";
import {
  Sbv1ToolbarDropdown,
  useSbv1ToolbarAnchor,
} from "./sbv1/sbv1-toolbar-anchor-popover";
import { LIBTV_DOCK_PARAMS_POPOVER_CLASS } from "./libtv-dock-picker-chrome";
import { LibtvVoiceSelectList } from "./libtv-voice-select-list";

/** Qwen3 TTS · 全量系统音色（百炼 49 种） */
export function LibtvQwenTtsDockVoicePicker({
  voiceId,
  savedLabel,
  disabled,
  open: controlledOpen,
  onOpenChange,
  onSelectVoice,
}: {
  voiceId: string;
  savedLabel?: string;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelectVoice: (voiceId: string, label: string) => void;
}) {
  const { anchorRef, open: internalOpen, setOpen: setInternalOpen, rect } =
    useSbv1ToolbarAnchor(controlledOpen);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const { fontPx, minHeightPx, chevronPx } = useLibtvDockToolbarMetrics();

  const options = useMemo(
    () =>
      QWEN3_TTS_FLASH_VOICES.map((v) => ({
        value: v.id,
        label: v.label,
      })),
    [],
  );
  const selectedLabel = resolveLibtvDockVoiceFullLabel({
    voiceId,
    savedLabel,
    catalogLabel: qwen3TtsVoiceLabel(voiceId),
  });

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled}
        title={selectedLabel}
        className="nodrag flex max-w-[11rem] shrink-0 items-center gap-1.5 rounded-md px-2.5 py-2 text-white hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
        style={{ fontSize: fontPx, minHeight: minHeightPx }}
        onClick={() => setOpen(!open)}
      >
        <span
          className={`min-w-0 truncate whitespace-nowrap ${LIBTV_DOCK_VOICE_TRIGGER_MAX_WIDTH_CLASS}`}
        >
          {selectedLabel}
        </span>
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
        estimatedHeight={320}
        containScroll
        className={LIBTV_DOCK_PARAMS_POPOVER_CLASS}
      >
        <div className="overflow-hidden px-1 pb-1">
          <p className="px-2 pb-1 pt-0.5 text-[11px] text-white/45">音色</p>
          <LibtvVoiceSelectList
            key={open ? "qwen-voice-open" : "qwen-voice-closed"}
            options={options}
            value={voiceId.trim() || "Cherry"}
            pageSize={10}
            maxHeightClass="max-h-[260px]"
            onSelect={(nextVoiceId) => {
              const hit = options.find((o) => o.value === nextVoiceId);
              onSelectVoice(nextVoiceId, hit?.label?.trim() || nextVoiceId);
              setOpen(false);
            }}
          />
        </div>
      </Sbv1ToolbarDropdown>
    </>
  );
}
