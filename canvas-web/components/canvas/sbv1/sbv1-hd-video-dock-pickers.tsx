"use client";

import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";

import { useLibtvDockToolbarMetrics } from "@/lib/canvas/use-libtv-dock-toolbar-metrics";
import type { Sbv1VideoEngineNodeData } from "@/lib/canvas/sbv1-workspace-types";
import {
  TOPAZ_HD_FRAME_INTERPOLATION_OPTIONS,
  TOPAZ_HD_RESOLUTION_OPTIONS,
  TOPAZ_HD_SLOWMO_OPTIONS,
  topazHdParamsTriggerLabel,
  type TopazFrameInterpolation,
  type TopazHdResolution,
  type TopazSlowmo,
} from "@/lib/canvas/sbv1-hd-video-params";
import { cn } from "@/lib/utils";
import {
  LIBTV_DOCK_POPOVER_CLASS,
  LIBTV_DOCK_PICKER_CHECK_CLASS,
} from "../libtv-dock-picker-chrome";
import {
  Sbv1ToolbarDropdown,
  useSbv1ToolbarAnchor,
} from "./sbv1-toolbar-anchor-popover";

function patchTopazHdParams(
  data: Sbv1VideoEngineNodeData,
  onPatch: (patch: Partial<Sbv1VideoEngineNodeData>) => void,
  next: {
    resolution?: TopazHdResolution;
    frameInterpolation?: TopazFrameInterpolation;
    slowmo?: TopazSlowmo;
  },
) {
  const params = { ...(data.engine?.params ?? {}) };
  if (next.frameInterpolation != null) {
    params.frame_interpolation = next.frameInterpolation;
  }
  if (next.slowmo != null) {
    params.slowmo = next.slowmo;
  }
  onPatch({
    resolution: next.resolution ?? data.resolution,
    engine: {
      ...data.engine!,
      params,
    },
  });
}

/** 高清视频 Dock · Topaz 固定模型 + 分辨率 / 补帧 / 慢放 */
export function Sbv1HdVideoDockToolbar({
  data,
  disabled,
  onPatch,
}: {
  data: Sbv1VideoEngineNodeData;
  disabled?: boolean;
  onPatch: (patch: Partial<Sbv1VideoEngineNodeData>) => void;
}) {
  const { fontPx, minHeightPx, chevronPx } = useLibtvDockToolbarMetrics();
  const { anchorRef, open, setOpen, rect } = useSbv1ToolbarAnchor();
  const label = topazHdParamsTriggerLabel(data);
  const params = data.engine?.params ?? {};
  const resolution = (data.resolution === "2k" || data.resolution === "4k"
    ? data.resolution
    : "1080p") as TopazHdResolution;
  const frameInterpolation = (params.frame_interpolation === "high"
    ? "high"
    : "none") as TopazFrameInterpolation;
  const slowmo = ([1, 2, 3, 5] as const).includes(
    Number(params.slowmo) as TopazSlowmo,
  )
    ? (Number(params.slowmo) as TopazSlowmo)
    : 1;

  return (
    <>
      <span
        className="nodrag flex shrink-0 items-center rounded-md px-2.5 py-2 text-white/85"
        style={{ fontSize: fontPx, minHeight: minHeightPx }}
        title="Topaz Labs 高清视频增强"
      >
        Topaz
      </span>
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled}
        title={label}
        className="nodrag flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-2 text-white hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
        style={{ fontSize: fontPx, minHeight: minHeightPx }}
        onClick={() => setOpen(!open)}
      >
        <SlidersHorizontal className="size-3.5 shrink-0 text-white/55" />
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
        estimatedHeight={320}
        className={LIBTV_DOCK_POPOVER_CLASS}
      >
        <p className="px-3 pb-1.5 pt-0.5 text-[13px] font-medium text-white/75">
          高清视频参数
        </p>
        <div className="space-y-0 px-3 pb-2">
          <ParamRow label="分辨率">
            <SegmentGroup
              options={TOPAZ_HD_RESOLUTION_OPTIONS}
              value={resolution}
              onSelect={(id) =>
                patchTopazHdParams(data, onPatch, { resolution: id })
              }
            />
          </ParamRow>
          <ParamRow label="补帧模式">
            <SelectBtn
              value={
                TOPAZ_HD_FRAME_INTERPOLATION_OPTIONS.find(
                  (o) => o.id === frameInterpolation,
                )?.label ?? "不补帧"
              }
              options={TOPAZ_HD_FRAME_INTERPOLATION_OPTIONS.map((o) => ({
                id: o.id,
                label: o.label,
              }))}
              onSelect={(id) =>
                patchTopazHdParams(data, onPatch, {
                  frameInterpolation: id as TopazFrameInterpolation,
                })
              }
            />
          </ParamRow>
          <ParamRow label="慢放倍数">
            <SelectBtn
              value={
                TOPAZ_HD_SLOWMO_OPTIONS.find((o) => o.id === slowmo)?.label ??
                "1x"
              }
              options={TOPAZ_HD_SLOWMO_OPTIONS.map((o) => ({
                id: String(o.id),
                label: o.label,
              }))}
              onSelect={(id) =>
                patchTopazHdParams(data, onPatch, {
                  slowmo: parseInt(id, 10) as TopazSlowmo,
                })
              }
            />
          </ParamRow>
        </div>
      </Sbv1ToolbarDropdown>
    </>
  );
}

function ParamRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="shrink-0 text-[13px] text-white/55">{label}</span>
      <div className="min-w-0 flex-1 flex justify-end">{children}</div>
    </div>
  );
}

function SegmentGroup<T extends string>({
  options,
  value,
  onSelect,
}: {
  options: { id: T; label: string }[];
  value: T;
  onSelect: (id: T) => void;
}) {
  return (
    <div className="flex shrink-0 rounded-lg border border-white/10 p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={cn(
            "rounded-md px-2.5 py-1 text-[12px] font-medium transition",
            value === o.id
              ? "bg-white/15 text-white"
              : "text-white/55 hover:text-white/80",
          )}
          onClick={() => onSelect(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SelectBtn({
  value,
  options,
  onSelect,
}: {
  value: string;
  options: { id: string; label: string }[];
  onSelect: (id: string) => void;
}) {
  const { anchorRef, open, setOpen, rect } = useSbv1ToolbarAnchor();
  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="nodrag flex min-w-[120px] items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12px] text-white/85 hover:bg-white/[0.07]"
        onClick={() => setOpen(!open)}
      >
        <span>{value}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-45" />
      </button>
      <Sbv1ToolbarDropdown
        open={open}
        setOpen={setOpen}
        rect={rect}
        placement="auto"
        estimatedHeight={160}
        className={cn(LIBTV_DOCK_POPOVER_CLASS, "min-w-[140px]")}
      >
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-white/85 hover:bg-white/[0.06]"
            onClick={() => {
              onSelect(o.id);
              setOpen(false);
            }}
          >
            <span className="flex-1">{o.label}</span>
            {o.label === value ? (
              <Check className={LIBTV_DOCK_PICKER_CHECK_CLASS} />
            ) : null}
          </button>
        ))}
      </Sbv1ToolbarDropdown>
    </>
  );
}
