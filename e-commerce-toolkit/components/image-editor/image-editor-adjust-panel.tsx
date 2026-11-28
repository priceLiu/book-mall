"use client";

import {
  ChevronDown,
  ChevronUp,
  FlipHorizontal,
  FlipVertical,
  HelpCircle,
  Link2,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import type { ReactNode } from "react";

import { ImageEditorShapeGrid } from "@/components/image-editor/image-editor-shape-grid";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  formatImageEditorPresetPixels,
  IMAGE_EDITOR_ECOM_SIZE_PRESETS,
  IMAGE_EDITOR_RATIO_PRESETS,
} from "@/lib/image-editor-presets";
import type {
  ImageEditorAdjustTab,
  ImageEditorPresetSize,
  ImageEditorShapeMaskId,
} from "@/lib/image-editor-types";
import { cn } from "@/lib/utils";

type Props = {
  tab: ImageEditorAdjustTab;
  onTab: (tab: ImageEditorAdjustTab) => void;
  targetWidth: number;
  targetHeight: number;
  lockAspect: boolean;
  naturalWidth: number;
  naturalHeight: number;
  losslessResize: boolean;
  onLosslessResize: (v: boolean) => void;
  customPresets: ImageEditorPresetSize[];
  onAddCustomPreset: () => void;
  onWidth: (v: number) => void;
  onHeight: (v: number) => void;
  onToggleLock: () => void;
  onPreset: (w: number, h: number) => void;
  onFreeCrop: () => void;
  onRotateCw: () => void;
  onRotateCcw: () => void;
  onFlipH: () => void;
  onFlipV: () => void;
  onCancel: () => void;
  onApply: () => void;
  busy?: boolean;
  hasImage: boolean;
  correctionOpen: boolean;
  onToggleCorrection: () => void;
  onCloseCorrection: () => void;
  correctionPanel?: ReactNode;
  shapeMask: ImageEditorShapeMaskId;
  onShapeMask: (id: ImageEditorShapeMaskId) => void;
  onRatioPreset: (w: number, h: number) => void;
  sectionOpen: boolean;
  onSectionOpenChange: (open: boolean) => void;
};

const TABS: Array<{ id: ImageEditorAdjustTab; label: string }> = [
  { id: "resize", label: "尺寸调整" },
  { id: "ratio", label: "比例裁剪" },
  { id: "shape", label: "形状蒙版" },
];

export function ImageEditorAdjustPanel(props: Props) {
  const sectionOpen = props.sectionOpen;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] shadow-sm">
        <button
          type="button"
          className="flex w-full items-center justify-between px-3 py-2.5 text-left"
          onClick={() => {
            if (sectionOpen) {
              props.onSectionOpenChange(false);
              return;
            }
            props.onSectionOpenChange(true);
            props.onCloseCorrection();
          }}
        >
          <span className="text-[12px] font-semibold text-[var(--ie-ink)]">裁剪/旋转/尺寸</span>
          {sectionOpen ? (
            <ChevronUp className="h-4 w-4 text-[var(--ie-subtle)]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[var(--ie-subtle)]" />
          )}
        </button>

        {sectionOpen ? (
          <div className="border-t border-[var(--ie-divider)] px-3 pb-3 pt-3">
            <AdjustTabs tabs={TABS} active={props.tab} onSelect={props.onTab} />
            <AdjustBody {...props} />
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] shadow-sm">
        <button
          type="button"
          className="flex w-full items-center justify-between px-3 py-2.5 text-left"
          onClick={props.onToggleCorrection}
        >
          <span className="text-[12px] font-semibold text-[var(--ie-ink)]">图片校正</span>
          {props.correctionOpen ? (
            <ChevronUp className="h-4 w-4 text-[var(--ie-subtle)]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[var(--ie-subtle)]" />
          )}
        </button>
        {props.correctionOpen && props.correctionPanel ? (
          <div className="border-t border-[var(--ie-divider)] px-3 pb-3 pt-3">{props.correctionPanel}</div>
        ) : null}
      </div>
    </div>
  );
}

function AdjustActionsFooter({ showCustomPreset, ...p }: Props & { showCustomPreset: boolean }) {
  return (
    <>
      {showCustomPreset ? (
        <EcomButtonSecondary
          type="button"
          className="w-full text-[12px]"
          disabled={!p.hasImage || p.busy}
          onClick={p.onAddCustomPreset}
        >
          添加自定义尺寸
        </EcomButtonSecondary>
      ) : null}

      <TransformRow {...p} />

      <label className="flex items-center justify-between gap-2 py-1">
        <span className="flex items-center gap-1 text-[11px] text-[var(--ie-muted)]">
          无损改尺寸
          <span className="text-[var(--ie-subtle)]" title="开启后缩放以完整保留画面为主，减少硬裁切">
            <HelpCircle className="h-3.5 w-3.5" aria-hidden />
          </span>
        </span>
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-[var(--ie-border-soft)] accent-[var(--ie-border)]"
          checked={p.losslessResize}
          disabled={!p.hasImage || p.busy}
          onChange={(e) => p.onLosslessResize(e.target.checked)}
        />
      </label>

      <div className="flex gap-2 pt-1">
        <EcomButtonSecondary
          type="button"
          className="flex-1"
          disabled={!p.hasImage || p.busy}
          onClick={p.onCancel}
        >
          取消
        </EcomButtonSecondary>
        <EcomButtonPrimary
          type="button"
          className="flex-1"
          disabled={!p.hasImage || p.busy}
          onClick={p.onApply}
        >
          应用
        </EcomButtonPrimary>
      </div>
    </>
  );
}

function AdjustBody(props: Props) {
  const allPresets = [...IMAGE_EDITOR_ECOM_SIZE_PRESETS, ...props.customPresets];

  if (props.tab === "shape") {
    return (
      <div className="mt-3 space-y-3">
        <ImageEditorShapeGrid
          value={props.shapeMask}
          disabled={!props.hasImage || props.busy}
          onChange={props.onShapeMask}
        />
        <AdjustActionsFooter {...props} showCustomPreset={false} />
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {props.tab === "resize" ? (
        <PresetList>
          <PresetRow
            variant="lead"
            label="自由调整"
            sub={
              props.naturalWidth > 0
                ? formatImageEditorPresetPixels(props.naturalWidth, props.naturalHeight)
                : ""
            }
            disabled={!props.hasImage || props.busy}
            onClick={props.onFreeCrop}
          />
          {allPresets.map((row) => (
            <PresetRow
              key={row.id}
              label={row.label}
              sub={formatImageEditorPresetPixels(row.width, row.height)}
              disabled={!props.hasImage || props.busy}
              onClick={() => props.onPreset(row.width, row.height)}
            />
          ))}
        </PresetList>
      ) : (
        <PresetList>
          <PresetRow
            variant="lead"
            label="自由裁剪"
            sub={
              props.naturalWidth > 0
                ? formatImageEditorPresetPixels(props.naturalWidth, props.naturalHeight)
                : ""
            }
            disabled={!props.hasImage || props.busy}
            onClick={props.onFreeCrop}
          />
          {IMAGE_EDITOR_RATIO_PRESETS.map((r) => (
            <PresetRow
              key={r.id}
              label={r.label}
              sub=""
              disabled={!props.hasImage || props.busy}
              onClick={() => props.onRatioPreset(r.w, r.h)}
            />
          ))}
        </PresetList>
      )}

      {props.tab === "resize" ? <PixelSizeFields {...props} /> : null}

      <AdjustActionsFooter {...props} showCustomPreset={props.tab === "resize"} />
    </div>
  );
}

function PixelSizeFields(props: Props) {
  const field =
    "min-w-0 flex-1 rounded-lg border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] px-2 py-1.5 text-center text-[12px] text-[var(--ie-ink)] disabled:opacity-40";
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={8192}
        aria-label="宽度（像素）"
        disabled={!props.hasImage || props.busy}
        value={props.targetWidth}
        className={field}
        onChange={(e) => props.onWidth(Number(e.target.value) || 1)}
      />
      <button
        type="button"
        disabled={!props.hasImage || props.busy}
        title={props.lockAspect ? "已锁定比例" : "锁定比例"}
        aria-pressed={props.lockAspect}
        className={cn(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border disabled:opacity-40",
          props.lockAspect
            ? "border-[var(--ie-border)] bg-[var(--ie-cream-muted)] text-[var(--ie-ink)]"
            : "border-[var(--ie-border-soft)] text-[var(--ie-muted)]",
        )}
        onClick={props.onToggleLock}
      >
        <Link2 className="h-3.5 w-3.5" aria-hidden />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={8192}
        aria-label="高度（像素）"
        disabled={!props.hasImage || props.busy}
        value={props.targetHeight}
        className={field}
        onChange={(e) => props.onHeight(Number(e.target.value) || 1)}
      />
      <span className="inline-flex h-8 shrink-0 items-center rounded-lg border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] px-2 text-[11px] text-[var(--ie-ink)]">
        像素
      </span>
    </div>
  );
}

function PresetList({ children }: { children: ReactNode }) {
  return (
    <div className="max-h-[220px] space-y-0 overflow-y-auto ecom-scrollbar-thin pr-1">
      {children}
    </div>
  );
}

function TransformRow(props: Props) {
  const btn =
    "flex h-9 flex-1 items-center justify-center rounded-lg border border-[var(--ie-border-soft)] bg-[var(--ie-cream-muted)] text-[var(--ie-muted)] hover:border-[var(--ie-border)] disabled:opacity-40";
  return (
    <div className="flex gap-2">
      <button type="button" className={btn} title="逆时针旋转 45°" disabled={!props.hasImage || props.busy} onClick={props.onRotateCcw}>
        <RotateCcw className="h-4 w-4" />
      </button>
      <button type="button" className={btn} title="顺时针旋转 45°" disabled={!props.hasImage || props.busy} onClick={props.onRotateCw}>
        <RotateCw className="h-4 w-4" />
      </button>
      <button type="button" className={btn} title="水平翻转" disabled={!props.hasImage || props.busy} onClick={props.onFlipH}>
        <FlipHorizontal className="h-4 w-4" />
      </button>
      <button type="button" className={btn} title="垂直翻转" disabled={!props.hasImage || props.busy} onClick={props.onFlipV}>
        <FlipVertical className="h-4 w-4" />
      </button>
    </div>
  );
}

function PresetRow({
  label,
  sub,
  variant,
  disabled,
  onClick,
}: {
  label: string;
  sub: string;
  variant?: "lead";
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="flex w-full items-center justify-between gap-2 border-b border-[var(--ie-divider)] px-1 py-2 text-left last:border-0 hover:bg-[var(--ie-cream-muted)] disabled:opacity-40"
      onClick={onClick}
    >
      <span
        className={cn(
          "text-[11px]",
          variant === "lead" ? "font-semibold text-[var(--ie-ink)]" : "text-[var(--ie-ink)]",
        )}
      >
        {label}
      </span>
      {sub ? <span className="shrink-0 text-[10px] text-[var(--ie-subtle)]">{sub}</span> : null}
    </button>
  );
}

function AdjustTabs<T extends string>({
  tabs,
  active,
  onSelect,
}: {
  tabs: Array<{ id: T; label: string }>;
  active: T;
  onSelect: (id: T) => void;
}) {
  return (
    <div className="mb-2 flex items-stretch gap-1 rounded-lg bg-[var(--ie-cream-deep)] p-0.5">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={cn(
            "flex min-h-[30px] flex-1 items-center justify-center rounded-md px-1 py-1.5 text-[10px] leading-tight font-medium transition-colors",
            active === t.id
              ? "bg-[var(--ie-cream)] text-[var(--ie-ink)] shadow-sm ring-1 ring-[var(--ie-border-soft)]"
              : "text-[var(--ie-subtle)]",
          )}
          onClick={() => onSelect(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}