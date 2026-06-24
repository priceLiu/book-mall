"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X } from "lucide-react";
import { EnginePicker } from "@/components/canvas/engine-picker";
import { GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID } from "@/lib/canvas/system-providers";
import type { CanvasProviderDto } from "@/lib/canvas-providers-api";
import {
  SBV1_ASPECT_RATIOS,
  SBV1_REFERENCE_MODES,
  SBV1_VOLCENGINE_GATEWAY_MODEL_KEYS,
  getSbv1VolcengineModelById,
  migrateSbv1ModelVariantId,
  resolveSbv1VariantIdFromEngine,
  sbv1AspectRatioLabel,
} from "@/lib/canvas/sbv1-video-models";
import type {
  Sbv1AspectRatio,
  Sbv1ReferenceMode,
  Sbv1VideoEngineNodeData,
} from "@/lib/canvas/sbv1-workspace-types";
import { cn } from "@/lib/utils";

const MODAL_Z = 1200;

const RESOLUTION_OPTIONS = [
  { id: "720p", label: "720p" },
  { id: "1080p", label: "1080p" },
] as const;

export type Sbv1VideoGenerateSettingsModalProps = {
  open: boolean;
  data: Sbv1VideoEngineNodeData;
  onClose: () => void;
  onConfirm: (patch: Partial<Sbv1VideoEngineNodeData>) => void;
};

/** 分镜视频 1.0 · 紧凑单弹层（模型优先 · 见 libtv-generate-settings-spec.md） */
export function Sbv1VideoGenerateSettingsModal({
  open,
  data,
  onClose,
  onConfirm,
}: Sbv1VideoGenerateSettingsModalProps) {
  const [mounted, setMounted] = useState(false);

  const [referenceMode, setReferenceMode] = useState<Sbv1ReferenceMode>(
    data.referenceMode,
  );
  const [aspectRatio, setAspectRatio] = useState<Sbv1AspectRatio>(
    data.aspectRatio,
  );
  const [durationSec, setDurationSec] = useState(data.durationSec);
  const [resolution, setResolution] = useState(data.resolution);
  const [providerId, setProviderId] = useState(
    normalizeSbv1EngineProviderId(data.engine?.providerId),
  );
  const [modelKey, setModelKey] = useState(data.engine?.modelKey ?? "");
  const [engineParams, setEngineParams] = useState<Record<string, unknown>>(
    data.engine?.params ?? {},
  );
  const [generateAudio, setGenerateAudio] = useState(
    data.engine?.params?.generate_audio !== false,
  );
  const [watermark, setWatermark] = useState(
    Boolean(data.engine?.params?.watermark),
  );

  const smartMulti = referenceMode === "smart_multi";

  const effectiveDurationSec = useMemo(() => {
    if (smartMulti) return 0;
    const fromParams = Number(engineParams.duration);
    if (Number.isFinite(fromParams) && fromParams >= 4 && fromParams <= 15) {
      return fromParams;
    }
    if (durationSec >= 4 && durationSec <= 15) return durationSec;
    return 15;
  }, [smartMulti, engineParams.duration, durationSec]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setReferenceMode(data.referenceMode);
    setAspectRatio(data.aspectRatio);
    setDurationSec(data.durationSec);
    setResolution(data.resolution);
    setProviderId(normalizeSbv1EngineProviderId(data.engine?.providerId));
    setModelKey(data.engine?.modelKey ?? "");
    setEngineParams(data.engine?.params ?? {});
    setGenerateAudio(data.engine?.params?.generate_audio !== false);
    setWatermark(Boolean(data.engine?.params?.watermark));
  }, [open, data]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const handleConfirm = () => {
    if (!providerId.trim() || !modelKey.trim()) return;
    const mergedParams = {
      ...engineParams,
      resolution,
      generate_audio: generateAudio,
      watermark,
      ...(smartMulti ? {} : { duration: effectiveDurationSec }),
    };
    const engine = {
      providerId,
      modelKey,
      params: mergedParams,
    };
    const variantId = resolveSbv1VariantIdFromEngine(engine);
    onConfirm({
      referenceMode,
      aspectRatio,
      durationSec: smartMulti ? 0 : effectiveDurationSec,
      resolution,
      volcengineVariantId: variantId,
      jimengModelId: variantId,
      engine,
    });
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      style={{ zIndex: MODAL_Z }}
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="nodrag nowheel flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--canvas-surface,#161427)] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/5 px-4 py-3">
          <p className="flex items-center gap-2 text-[14px] font-medium text-white">
            <Sparkles className="size-4 text-[var(--canvas-accent)]" />
            视频生成设置
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
              role="VIDEO"
              embedded
              modelsOnly
              providerIds={[GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID]}
              allowedModelKeys={[...SBV1_VOLCENGINE_GATEWAY_MODEL_KEYS]}
              providerId={providerId}
              modelKey={modelKey}
              params={engineParams}
              onChange={(next) => {
                setProviderId(next.providerId);
                setModelKey(next.modelKey);
                setEngineParams({
                  ...next.params,
                  generate_audio: generateAudio,
                });
              }}
            />
          </div>

          <div className="flex flex-wrap items-start gap-x-5 gap-y-2">
            <LabeledSegment
              label="参考模式"
              options={SBV1_REFERENCE_MODES.map((m) => ({
                id: m.id,
                label: m.label,
              }))}
              value={referenceMode}
              onChange={(id) => {
                const mode = id as Sbv1ReferenceMode;
                setReferenceMode(mode);
                if (mode === "smart_multi") {
                  setDurationSec(0);
                } else if (durationSec < 4 || durationSec > 15) {
                  setDurationSec(15);
                }
              }}
            />
            <LabeledSegment
              label="分辨率"
              options={RESOLUTION_OPTIONS.map((r) => ({
                id: r.id,
                label: r.label,
              }))}
              value={resolution}
              onChange={(id) => {
                const next = id as "720p" | "1080p";
                setResolution(next);
                setEngineParams((p) => ({ ...p, resolution: next }));
              }}
            />
          </div>

          <LabeledSegment
            label="比例"
            options={SBV1_ASPECT_RATIOS.map((r) => ({
              id: r,
              label: sbv1AspectRatioLabel(r),
            }))}
            value={aspectRatio}
            onChange={(id) => setAspectRatio(id as Sbv1AspectRatio)}
            compact
          />

          {!smartMulti ? (
            <div>
              <div className="mb-1 flex items-center justify-between text-[12px] text-white/55">
                <span>时长</span>
                <span className="tabular-nums text-white/75">
                  {effectiveDurationSec}s
                </span>
              </div>
              <input
                type="range"
                min={4}
                max={15}
                step={1}
                value={effectiveDurationSec}
                className="nodrag h-1.5 w-full cursor-pointer accent-[var(--canvas-accent)]"
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setDurationSec(next);
                  setEngineParams((p) => ({ ...p, duration: next }));
                }}
              />
            </div>
          ) : null}

          <div className="flex flex-wrap items-start gap-x-5 gap-y-2">
            <BooleanSegment
              label="生成音频"
              value={generateAudio}
              onChange={setGenerateAudio}
            />
            <BooleanSegment
              label="水印"
              value={watermark}
              onChange={setWatermark}
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

function BooleanSegment({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="shrink-0">
      <p className="mb-1 text-[12px] text-white/55">{label}</p>
      <div className="flex gap-1.5">
        <SegmentButton
          active={value}
          onClick={() => onChange(true)}
          label="开启"
        />
        <SegmentButton
          active={!value}
          onClick={() => onChange(false)}
          label="关闭"
        />
      </div>
    </div>
  );
}

function SegmentButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "min-w-[3rem] rounded-md border px-2.5 py-1 text-[12px] font-medium transition",
        active
          ? "border-white bg-white/[.06] text-white"
          : "border-white/15 text-white/55 hover:border-white/30 hover:text-white/80",
      )}
      onClick={onClick}
    >
      {label}
    </button>
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
            compact
              ? "min-w-[2.75rem] px-2 py-1 text-[11px]"
              : "min-w-[2.25rem] px-2.5 py-1 text-[12px]",
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

function normalizeSbv1EngineProviderId(id: string | undefined): string {
  const trimmed = id?.trim() ?? "";
  if (!trimmed || trimmed === "gateway:volcengine") {
    return GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID;
  }
  return trimmed;
}

/** 工具条触发按钮文案 */
export function sbv1VideoSettingsTriggerLabel(
  data: Sbv1VideoEngineNodeData,
  providers: CanvasProviderDto[],
): string {
  const smartMulti = data.referenceMode === "smart_multi";
  const durationLabel =
    !smartMulti && data.durationSec >= 4 && data.durationSec <= 15
      ? ` · ${data.durationSec}s`
      : smartMulti
        ? " · 智能多帧"
        : "";

  const engineKey = data.engine?.modelKey?.trim();
  if (engineKey) {
    const sbv1 = providers.find(
      (p) => p.id === GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID,
    );
    const gw = sbv1?.models.find(
      (m) => m.modelKey.toLowerCase() === engineKey.toLowerCase(),
    );
    const name = gw?.displayName?.trim() || engineKey;
    return `${name}${durationLabel}`;
  }
  const variantId = migrateSbv1ModelVariantId(
    data.volcengineVariantId ?? data.jimengModelId,
  );
  const model = getSbv1VolcengineModelById(variantId, providers);
  if (model?.displayName) return `${model.displayName}${durationLabel}`;
  return "选择模型与参数";
}
