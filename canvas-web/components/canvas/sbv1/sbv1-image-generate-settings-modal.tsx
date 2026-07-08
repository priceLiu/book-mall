"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X } from "lucide-react";
import {
  useClientPortalMounted,
  useModalBodyScrollLock,
  useModalEscapeClose,
} from "@/lib/canvas/use-modal-portal-effects";
import { EnginePicker } from "@/components/canvas/engine-picker";
import {
  buildSbv1ImageEngineSettingsPatch,
} from "./sbv1-image-dock-pickers";
import {
  SBV1_IMAGE_ASPECT_RATIOS,
  SBV1_IMAGE_MODEL_KEYS,
  SBV1_IMAGE_OUTPUT_COUNTS,
  SBV1_IMAGE_RESOLUTIONS,
  sbv1ImageAspectRatioLabel,
  type Sbv1ImageAspectRatio,
  type Sbv1ImageQuality,
  type Sbv1ImageResolution,
} from "@/lib/canvas/sbv1-image-models";
import type { Sbv1ImageNodeData } from "@/lib/canvas/sbv1-workspace-types";
import { ENGINE_PICKER_MODAL_BG } from "@/lib/canvas/gateway-model-role";
import { cn } from "@/lib/utils";

import { LIBTV_GENERATE_SETTINGS_MODAL_Z } from "@/lib/canvas/libtv-generate-settings-modal-z";

const MODAL_Z = LIBTV_GENERATE_SETTINGS_MODAL_Z;

const QUALITY_OPTIONS: { id: Sbv1ImageQuality; label: string }[] = [
  { id: "low", label: "低" },
  { id: "standard", label: "标准" },
  { id: "high", label: "高" },
];

const FORMAT_OPTIONS = ["png", "jpeg", "webp"] as const;
type OutputFormat = (typeof FORMAT_OPTIONS)[number];

export type Sbv1ImageGenerateSettingsModalProps = {
  open: boolean;
  data: Sbv1ImageNodeData;
  onClose: () => void;
  onConfirm: (patch: Partial<Sbv1ImageNodeData>) => void;
  /** 默认 SBV1_IMAGE_MODEL_KEYS；Pro2 分镜图等可传入 PRO2_FRAME_IMAGE_MODEL_KEYS */
  allowedModelKeys?: string[];
  /** 嵌套在其它弹层内时须高于宿主（如角色三视图批量选择 z-1200） */
  modalZIndex?: number;
};

/** 分镜视频 1.0 · 图片模型 + 画质 / 清晰度 / 比例（紧凑单弹层） */
export function Sbv1ImageGenerateSettingsModal({
  open,
  data,
  onClose,
  onConfirm,
  allowedModelKeys,
  modalZIndex = MODAL_Z,
}: Sbv1ImageGenerateSettingsModalProps) {
  const mounted = useClientPortalMounted();
  useModalBodyScrollLock(open);
  useModalEscapeClose(onClose, { active: open });

  const [imageQuality, setImageQuality] = useState<Sbv1ImageQuality>(
    data.imageQuality ?? "standard",
  );
  const [resolution, setResolution] = useState<Sbv1ImageResolution>(
    data.resolution ?? "2K",
  );
  const [aspectRatio, setAspectRatio] = useState<Sbv1ImageAspectRatio>(
    data.aspectRatio ?? "auto",
  );
  const [outputCount, setOutputCount] = useState(data.outputCount ?? 1);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("png");
  const [providerId, setProviderId] = useState(data.engine?.providerId ?? "");
  const [modelKey, setModelKey] = useState(data.engine?.modelKey ?? "");
  const [engineParams, setEngineParams] = useState<Record<string, unknown>>(
    data.engine?.params ?? {},
  );
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    if (!open) return;
    const d = dataRef.current;
    setImageQuality(d.imageQuality ?? "standard");
    setResolution(d.resolution ?? "2K");
    setAspectRatio(d.aspectRatio ?? "auto");
    setOutputCount(d.outputCount ?? 1);
    setProviderId(d.engine?.providerId ?? "");
    setModelKey(d.engine?.modelKey ?? "");
    const params = d.engine?.params ?? {};
    setEngineParams(params);
    const fmt = String(params.output_format ?? "png").toLowerCase();
    setOutputFormat(
      FORMAT_OPTIONS.includes(fmt as OutputFormat) ? (fmt as OutputFormat) : "png",
    );
  }, [open]);

  if (!mounted || !open) return null;

  const handleConfirm = () => {
    if (!providerId.trim() || !modelKey.trim()) return;
    onConfirm(
      buildSbv1ImageEngineSettingsPatch({
        imageQuality,
        resolution,
        aspectRatio,
        outputCount,
        outputFormat,
        providerId,
        modelKey,
        engineParams,
      }),
    );
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      style={{
        zIndex: modalZIndex,
        isolation: "isolate",
        transform: "translateZ(0)",
        backfaceVisibility: "hidden",
      }}
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="nodrag nowheel flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
        style={{ backgroundColor: ENGINE_PICKER_MODAL_BG }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/5 px-4 py-3">
          <p className="flex items-center gap-2 text-[14px] font-medium text-white">
            <Sparkles className="size-4 text-[var(--canvas-accent)]" />
            图片生成设置
          </p>
          <button
            type="button"
            onClick={onClose}
            className="grid size-7 shrink-0 place-items-center rounded-md text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <div>
            <p className="mb-1.5 text-[12px] text-white/55">模型</p>
            <EnginePicker
              role="IMAGE"
              embedded
              modelsOnly
              allowedModelKeys={allowedModelKeys ?? [...SBV1_IMAGE_MODEL_KEYS]}
              providerId={providerId}
              modelKey={modelKey}
              params={engineParams}
              onChange={(next) => {
                setProviderId(next.providerId);
                setModelKey(next.modelKey);
                setEngineParams(next.params);
              }}
            />
          </div>

          <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
            <LabeledSegment
              label="画质"
              options={QUALITY_OPTIONS}
              value={imageQuality}
              onChange={(id) => setImageQuality(id as Sbv1ImageQuality)}
            />
            <LabeledSegment
              label="清晰度"
              options={SBV1_IMAGE_RESOLUTIONS.map((r) => ({
                id: r.value,
                label: r.label,
              }))}
              value={resolution}
              onChange={(id) => setResolution(id as Sbv1ImageResolution)}
            />
          </div>

          <LabeledSegment
            label="比例"
            options={SBV1_IMAGE_ASPECT_RATIOS.map((r) => ({
              id: r.value,
              label: sbv1ImageAspectRatioLabel(r.value),
            }))}
            value={aspectRatio}
            onChange={(id) => setAspectRatio(id as Sbv1ImageAspectRatio)}
            compact
          />

          <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
            <LabeledSegment
              label="张数"
              options={SBV1_IMAGE_OUTPUT_COUNTS.map((n) => ({
                id: String(n),
                label: String(n),
              }))}
              value={String(outputCount)}
              onChange={(id) => setOutputCount(Number(id) || 1)}
            />
            <LabeledSegment
              label="格式"
              options={FORMAT_OPTIONS.map((f) => ({ id: f, label: f }))}
              value={outputFormat}
              onChange={(id) => setOutputFormat(id as OutputFormat)}
            />
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-white/5 bg-black/20 px-4 py-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-white/80 hover:border-white/30 hover:text-white"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!providerId.trim() || !modelKey.trim()}
            onClick={handleConfirm}
            className="rounded-md bg-[var(--canvas-accent)] px-4 py-1.5 text-[12px] font-medium text-white hover:bg-[var(--canvas-accent-soft)] disabled:opacity-50"
          >
            确认
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function LabeledSegment({
  label,
  options,
  value,
  onChange,
  compact = false,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("min-w-0", compact ? "w-full" : "shrink-0")}>
      <p className="mb-1 text-[12px] text-white/55">{label}</p>
      <SegmentRow options={options} value={value} onChange={onChange} compact={compact} />
    </div>
  );
}

function SegmentRow({
  options,
  value,
  onChange,
  compact = false,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", compact && "max-w-full")}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={cn(
            "rounded-md border font-medium transition",
            compact ? "min-w-[2.75rem] px-2 py-1 text-[11px]" : "min-w-[2.25rem] px-2.5 py-1 text-[12px]",
            opt.id === value
              ? "border-white bg-white/[.06] text-white"
              : "border-white/15 text-white/55 hover:border-white/30 hover:text-white/80",
          )}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Dock 底栏触发文案（兼容旧引用） */
export {
  sbv1ImageModelTriggerLabel,
  sbv1ImageParamsTriggerLabel,
  sbv1ImageSettingsTriggerLabel,
  buildSbv1ImageEngineSettingsPatch,
} from "./sbv1-image-dock-pickers";
