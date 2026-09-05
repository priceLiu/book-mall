"use client";

import { ChevronDown } from "lucide-react";

import { useLibtvDockToolbarMetrics } from "@/lib/canvas/use-libtv-dock-toolbar-metrics";
import {
  LIBTV_DOCK_VOICE_TRIGGER_MAX_WIDTH_CLASS,
} from "@/lib/canvas/libtv-tts-voice-preference";
import {
  libtvTtsVoiceTriggerLabel,
  useLibtvMinimaxVoiceCatalog,
} from "@/lib/canvas/use-libtv-minimax-voice-catalog";
import {
  Sbv1ToolbarDropdown,
  useSbv1ToolbarAnchor,
} from "./sbv1/sbv1-toolbar-anchor-popover";
import { LIBTV_DOCK_PARAMS_POPOVER_CLASS } from "./libtv-dock-picker-chrome";
import { LibtvMinimaxVoiceCatalogList } from "./libtv-minimax-voice-catalog-list";

export { libtvTtsVoiceTriggerLabel };

export function LibtvTtsDockVoicePicker({
  voiceId,
  savedLabel,
  disabled,
  open: controlledOpen,
  onOpenChange,
  onSelectVoice,
}: {
  voiceId: string;
  /** 节点/本地记住的展示名 · 目录未加载时也能显示 */
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

  const { merged } = useLibtvMinimaxVoiceCatalog(open);
  const selectedLabel = libtvTtsVoiceTriggerLabel(voiceId, merged, savedLabel);

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
        estimatedHeight={360}
        containScroll
        className={LIBTV_DOCK_PARAMS_POPOVER_CLASS}
      >
        <LibtvMinimaxVoiceCatalogList
          active={open}
          voiceId={voiceId}
          disabled={disabled}
          listKey={open ? "voice-open" : "voice-closed"}
          onSelectVoice={(nextVoiceId, nextLabel) => {
            onSelectVoice(nextVoiceId, nextLabel);
            setOpen(false);
          }}
        />
      </Sbv1ToolbarDropdown>
    </>
  );
}
