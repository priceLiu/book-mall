"use client";

import { useMemo } from "react";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import type { StoryModelCapability } from "@/lib/canvas/story-model-capabilities";
import {
  collectLibtvDockEngineModels,
  resolveLibtvDockEngineModelDisplayName,
} from "@/lib/canvas/libtv-dock-engine-models";
import { hideKieVendorLabel, type GatewayModelRole } from "@/lib/canvas/gateway-model-role";
import type { CanvasProviderDto, CanvasProviderModelDto } from "@/lib/canvas-providers-api";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { useLibtvDockToolbarMetrics } from "@/lib/canvas/use-libtv-dock-toolbar-metrics";
import {
  Sbv1ToolbarDropdown,
  useSbv1ToolbarAnchor,
} from "./sbv1/sbv1-toolbar-anchor-popover";
import {
  LIBTV_DOCK_POPOVER_CLASS,
  LIBTV_DOCK_PICKER_CHECK_CLASS,
  libtvDockModelItemClassName,
} from "./libtv-dock-picker-chrome";

export type LibtvDockEngineModelPickerProps = {
  role: GatewayModelRole;
  providerId: string;
  modelKey: string;
  allowedModelKeys?: readonly string[];
  providerIds?: readonly string[];
  requiredCapabilities?: StoryModelCapability[];
  externalProviders?: CanvasProviderDto[];
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelect: (next: {
    providerId: string;
    modelKey: string;
    model: CanvasProviderModelDto;
  }) => void;
};

/** 浮动 Dock · 模型锚点 Popover（Gateway 列表 · 即时生效） */
export function LibtvDockEngineModelPicker({
  role,
  providerId,
  modelKey,
  allowedModelKeys,
  providerIds,
  requiredCapabilities,
  externalProviders,
  disabled,
  open: controlledOpen,
  onOpenChange,
  onSelect,
}: LibtvDockEngineModelPickerProps) {
  const { providers: hookProviders } = useUserProviders();
  const providers = externalProviders ?? hookProviders;
  const { anchorRef, open: internalOpen, setOpen: setInternalOpen, rect } =
    useSbv1ToolbarAnchor(controlledOpen);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const { fontPx, minHeightPx, chevronPx } = useLibtvDockToolbarMetrics();

  const models = useMemo(
    () =>
      collectLibtvDockEngineModels(providers, {
        role,
        allowedModelKeys,
        providerIds,
        requiredCapabilities,
      }),
    [providers, role, allowedModelKeys, providerIds, requiredCapabilities],
  );

  const label = resolveLibtvDockEngineModelDisplayName(modelKey, providers);
  const selectedKey = modelKey.trim();
  const selectedProvider = providerId.trim();

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
        <Sparkles className="size-3.5 shrink-0 text-white/55" />
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
        estimatedHeight={280}
        className={LIBTV_DOCK_POPOVER_CLASS}
      >
        <p className="px-3 pb-1.5 pt-0.5 text-[13px] font-medium text-white/75">
          选择模型
        </p>
        <div className="space-y-0.5 px-1.5">
          {models.map(({ providerId: pid, model }) => {
            const selected =
              selectedProvider === pid && selectedKey === model.modelKey;
            const displayName = hideKieVendorLabel(
              model.displayName || model.modelKey,
            );
            return (
              <button
                key={`${pid}:${model.modelKey}`}
                type="button"
                className={libtvDockModelItemClassName(selected)}
                onClick={() => {
                  onSelect({
                    providerId: pid,
                    modelKey: model.modelKey,
                    model,
                  });
                  setOpen(false);
                }}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-white/[0.06] text-[10px] font-semibold text-white/70">
                  {displayName.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-white">
                    {displayName}
                  </span>
                  <span className="block truncate text-[10px] text-white/40">
                    {model.modelKey}
                  </span>
                </span>
                {selected ? (
                  <Check className={LIBTV_DOCK_PICKER_CHECK_CLASS} />
                ) : null}
              </button>
            );
          })}
        </div>
      </Sbv1ToolbarDropdown>
    </>
  );
}
