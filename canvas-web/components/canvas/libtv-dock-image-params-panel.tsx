"use client";

import { cn } from "@/lib/utils";
import { parseAspectRatioToNumbers } from "@/lib/canvas/libtv-media-aspect-preset";

/** 图 1 · Dock 参数 Popover 壳层（340px · 图片/视频共用） */
export const LIBTV_DOCK_IMAGE_PARAMS_POPOVER_CLASS =
  "nodrag nowheel w-[min(340px,calc(100vw-20px))] max-h-[min(560px,88vh)] overflow-y-auto rounded-2xl border border-white/10 bg-[#1a1a1c] shadow-[0_8px_32px_rgba(0,0,0,0.45)] ring-0 outline-none";

/** @alias LIBTV_DOCK_IMAGE_PARAMS_POPOVER_CLASS */
export const LIBTV_DOCK_PARAMS_POPOVER_CLASS =
  LIBTV_DOCK_IMAGE_PARAMS_POPOVER_CLASS;

const SEGMENT_BTN =
  "flex flex-1 items-center justify-center whitespace-nowrap rounded-lg border border-solid px-2 text-[13px] transition-colors duration-200 h-8";

function segmentButtonClass(active: boolean): string {
  return cn(
    SEGMENT_BTN,
    active
      ? "border-white/25 bg-white/[0.12] text-white"
      : "border-white/10 bg-transparent text-white/45 hover:bg-white/[0.06] hover:text-white/70",
  );
}

function AspectRatioIcon({ ratio }: { ratio: string }) {
  const { w, h } = parseAspectRatioToNumbers(ratio);
  const max = 16;
  const scale = max / Math.max(w, h);
  const boxW = Math.max(6, Math.round(w * scale));
  const boxH = Math.max(6, Math.round(h * scale));
  return (
    <span className="flex size-[17px] items-center justify-center">
      <span
        className="flex-none rounded-[2px] border-[1.5px] border-current"
        style={{ width: boxW, height: boxH }}
      />
    </span>
  );
}

/** 画质 / 清晰度 / 生成数量 · 三等分横排 */
export function LibtvDockParamSegmentRow(props: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return <LibtvDockImageParamSegmentRow {...props} />;
}

/** @deprecated 使用 LibtvDockParamSegmentRow */
export const LibtvDockImageParamSegmentRow = function LibtvDockImageParamSegmentRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-sm font-medium text-white/45">
        <span>{label}</span>
      </div>
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={segmentButtonClass(opt.id === value)}
            onClick={() => onChange(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};

/** 时长 · 滑条（视频 Dock） */
export function LibtvDockDurationSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm font-medium text-white/45">
        <span>{label}</span>
        <span className="tabular-nums text-white/75">{value}s</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        className="nodrag h-1.5 w-full cursor-pointer accent-white"
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

/** 开关 · 二等分（生成音频 / 水印等） */
export function LibtvDockBooleanSegmentRow({
  label,
  value,
  onChange,
  trueLabel = "开",
  falseLabel = "关",
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  trueLabel?: string;
  falseLabel?: string;
}) {
  return (
    <LibtvDockParamSegmentRow
      label={label}
      options={[
        { id: "1", label: trueLabel },
        { id: "0", label: falseLabel },
      ]}
      value={value ? "1" : "0"}
      onChange={(id) => onChange(id === "1")}
    />
  );
}

/** 比例 · 网格 + 示意矩形（图 1） */
export function LibtvDockAspectRatioGrid({
  label,
  options,
  value,
  onChange,
  columns = 5,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  columns?: 3 | 5;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-sm font-medium text-white/45">
        <span>{label}</span>
      </div>
      <div
        className={cn(
          "grid gap-2",
          columns === 3 ? "grid-cols-3" : "grid-cols-5",
        )}
      >
        {options.map((opt) => {
          const active = opt.id === value;
          return (
            <button
              key={opt.id}
              type="button"
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-lg border border-solid px-1 py-3 transition-colors duration-200",
                active
                  ? "border-white/25 bg-white/[0.12] text-white"
                  : "border-white/10 bg-transparent text-white/45 hover:bg-white/[0.06] hover:text-white/70",
              )}
              onClick={() => onChange(opt.id)}
            >
              <AspectRatioIcon ratio={opt.id} />
              <span className="text-xs">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 图 1 完整参数面板 */
export function LibtvDockImageParamsPanel({
  qualityLabel,
  qualityOptions,
  qualityValue,
  onQualityChange,
  resolutionLabel,
  resolutionOptions,
  resolutionValue,
  onResolutionChange,
  aspectOptions,
  aspectValue,
  onAspectChange,
  countLabel,
  countOptions,
  countValue,
  onCountChange,
}: {
  qualityLabel: string;
  qualityOptions: { id: string; label: string }[];
  qualityValue: string;
  onQualityChange: (id: string) => void;
  resolutionLabel: string;
  resolutionOptions: { id: string; label: string }[];
  resolutionValue: string;
  onResolutionChange: (id: string) => void;
  aspectOptions: { id: string; label: string }[];
  aspectValue: string;
  onAspectChange: (id: string) => void;
  countLabel: string;
  countOptions: { id: string; label: string }[];
  countValue: string;
  onCountChange: (id: string) => void;
}) {
  return (
    <div className="flex w-full flex-col gap-2 rounded-2xl p-3">
      <LibtvDockImageParamSegmentRow
        label={qualityLabel}
        options={qualityOptions}
        value={qualityValue}
        onChange={onQualityChange}
      />
      <LibtvDockImageParamSegmentRow
        label={resolutionLabel}
        options={resolutionOptions}
        value={resolutionValue}
        onChange={onResolutionChange}
      />
      <LibtvDockAspectRatioGrid
        label="比例"
        options={aspectOptions}
        value={aspectValue}
        onChange={onAspectChange}
      />
      <LibtvDockImageParamSegmentRow
        label={countLabel}
        options={countOptions}
        value={countValue}
        onChange={onCountChange}
      />
    </div>
  );
}
