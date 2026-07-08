"use client";

import { useMemo } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { DynamicParamForm } from "@/components/canvas/dynamic-param-form";
import { resolveLibtvDockEngineModel } from "@/lib/canvas/libtv-dock-engine-models";
import type { CanvasProviderDto } from "@/lib/canvas-providers-api";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { useLibtvDockToolbarMetrics } from "@/lib/canvas/use-libtv-dock-toolbar-metrics";
import {
  Sbv1ToolbarDropdown,
  useSbv1ToolbarAnchor,
} from "./sbv1/sbv1-toolbar-anchor-popover";
import { LIBTV_DOCK_POPOVER_CLASS } from "./libtv-dock-picker-chrome";

export type LibtvDockGatewayParamsPickerProps = {
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
  externalProviders?: CanvasProviderDto[];
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 底栏摘要文案；未选模型时显示「参数」 */
  summaryLabel: string;
  onChange: (params: Record<string, unknown>) => void;
};

/** 浮动 Dock · Gateway schema 参数锚点 Popover（即时生效） */
export function LibtvDockGatewayParamsPicker({
  providerId,
  modelKey,
  params,
  externalProviders,
  disabled,
  open: controlledOpen,
  onOpenChange,
  summaryLabel,
  onChange,
}: LibtvDockGatewayParamsPickerProps) {
  const { providers: hookProviders } = useUserProviders();
  const providers = externalProviders ?? hookProviders;
  const { anchorRef, open: internalOpen, setOpen: setInternalOpen, rect } =
    useSbv1ToolbarAnchor(controlledOpen);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const { fontPx, minHeightPx, chevronPx } = useLibtvDockToolbarMetrics();
  const hasModel = Boolean(modelKey.trim());

  const resolvedModel = useMemo(
    () => resolveLibtvDockEngineModel(providers, providerId, modelKey),
    [providers, providerId, modelKey],
  );

  const schema = resolvedModel?.paramsSchema ?? [];
  const hasParams = schema.length > 0;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled || !hasModel}
        title={hasModel ? summaryLabel : "请先选择模型"}
        className="nodrag flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-2 text-white hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
        style={{ fontSize: fontPx, minHeight: minHeightPx }}
        onClick={() => setOpen(!open)}
      >
        <SlidersHorizontal className="size-3.5 shrink-0 text-white/55" />
        <span className="whitespace-nowrap">{hasModel ? summaryLabel : "参数"}</span>
        <ChevronDown
          className="shrink-0 opacity-45"
          style={{ width: chevronPx, height: chevronPx }}
        />
      </button>
      <Sbv1ToolbarDropdown
        open={open && hasModel && hasParams}
        setOpen={setOpen}
        rect={rect}
        placement="auto"
        estimatedHeight={320}
        className={LIBTV_DOCK_POPOVER_CLASS}
      >
        {hasParams ? (
          <div className="px-3 pb-1">
            <DynamicParamForm
              variant="panel"
              schema={schema}
              value={params}
              onChange={onChange}
            />
          </div>
        ) : (
          <p className="px-3 py-2 text-[12px] text-white/45">当前模型无可调参数</p>
        )}
      </Sbv1ToolbarDropdown>
    </>
  );
}

/** LLM 默认参数摘要（reasoning_effort · max_tokens） */
export function libtvLlmParamsSummaryLabel(
  params: Record<string, unknown>,
): string {
  const parts: string[] = [];
  const effort = String(params.reasoning_effort ?? "").trim();
  if (effort === "low") parts.push("低推理");
  else if (effort === "medium") parts.push("中推理");
  else if (effort === "high") parts.push("高推理");
  const maxTokens = Number(params.max_tokens);
  if (Number.isFinite(maxTokens) && maxTokens > 0) {
    parts.push(maxTokens >= 1000 ? `${Math.round(maxTokens / 1000)}k` : String(maxTokens));
  }
  const temp = Number(params.temperature);
  if (Number.isFinite(temp)) {
    parts.push(`T${temp}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "参数";
}
