"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X } from "lucide-react";
import {
  useClientPortalMounted,
  useModalBodyScrollLock,
  useModalEscapeClose,
} from "@/lib/canvas/use-modal-portal-effects";
import { EnginePicker } from "@/components/canvas/engine-picker";
import {
  GATEWAY_BAILIAN_PROVIDER_ID,
  GATEWAY_KIE_PROVIDER_ID,
  GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID,
} from "@/lib/canvas/system-providers";
import { hideKieVendorLabel, ENGINE_PICKER_MODAL_BG } from "@/lib/canvas/gateway-model-role";
import type { CanvasProviderDto, CanvasProviderModelDto } from "@/lib/canvas-providers-api";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { DynamicParamForm } from "@/components/canvas/dynamic-param-form";
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
import {
  clampSbv1ReferenceMode,
  getSbv1VideoModelRefCaps,
} from "@/lib/canvas/sbv1-video-model-reference";
import { cn } from "@/lib/utils";

const MODAL_Z = 1200;

const RESOLUTION_OPTIONS = [
  { id: "720p", label: "720p" },
  { id: "1080p", label: "1080p" },
] as const;

/**
 * 视频合成 dock 可选模型（统一选择器 · 单列列表）。
 * - Volcengine Seedance：SBV1_VOLCENGINE_GATEWAY_MODEL_KEYS
 * - KIE 可灵 i2v / 多镜头 / 动作控制：经 KIE Gateway 成片
 * - 百炼 R2V 多参 / 全能参考：经 runRefVideoEngineNode
 */
const SBV1_DOCK_EXTRA_VIDEO_MODEL_KEYS = [
  "kling-3.0/video",
  "kling/v3-turbo-image-to-video",
  "wan/2-7-image-to-video",
  "kling-2.6/motion-control",
  "kling-3.0/motion-control",
  "happyhorse-1.0-r2v",
  "wan2.7-r2v",
] as const;

const SBV1_DOCK_VIDEO_PROVIDER_IDS = [
  GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID,
  GATEWAY_KIE_PROVIDER_ID,
  GATEWAY_BAILIAN_PROVIDER_ID,
];

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
  const mounted = useClientPortalMounted();
  useModalBodyScrollLock(open);
  useModalEscapeClose(onClose, { active: open });
  const { providers } = useUserProviders();

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
  const [selectedModel, setSelectedModel] =
    useState<CanvasProviderModelDto | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  const isMotionControl = isSbv1MotionControlModelKey(modelKey);
  const klingMultiShots = engineParams.multi_shots === true;
  const isVolcDockModel =
    providerId === GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID && !isMotionControl;

  const refCaps = useMemo(
    () =>
      getSbv1VideoModelRefCaps(modelKey, {
        multiShots: klingMultiShots,
        providerId,
      }),
    [modelKey, klingMultiShots, providerId],
  );

  const referenceModeOptions = useMemo(
    () =>
      SBV1_REFERENCE_MODES.filter((m) =>
        refCaps.supportedModes.includes(m.id),
      ),
    [refCaps.supportedModes],
  );

  const showGatewayReferenceMode =
    !isMotionControl &&
    !isVolcDockModel &&
    referenceModeOptions.length > 1;

  const resolvedModel = useMemo(() => {
    if (selectedModel) return selectedModel;
    if (!providerId.trim() || !modelKey.trim()) return null;
    for (const p of providers) {
      if (p.id !== providerId) continue;
      const m = p.models.find((x) => x.modelKey === modelKey);
      if (m) return m;
    }
    return null;
  }, [selectedModel, providers, providerId, modelKey]);

  const smartMulti = referenceMode === "smart_multi" && isVolcDockModel;

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
    if (!open) return;
    const d = dataRef.current;
    setReferenceMode(d.referenceMode);
    setAspectRatio(d.aspectRatio);
    setDurationSec(d.durationSec);
    setResolution(d.resolution);
    setProviderId(normalizeSbv1EngineProviderId(d.engine?.providerId));
    setModelKey(d.engine?.modelKey ?? "");
    setEngineParams(d.engine?.params ?? {});
    setGenerateAudio(d.engine?.params?.generate_audio !== false);
    setWatermark(Boolean(d.engine?.params?.watermark));
  }, [open]);

  if (!mounted || !open) return null;

  const handleConfirm = () => {
    if (!providerId.trim() || !modelKey.trim()) return;
    const mergedParams = isVolcDockModel
      ? {
          ...engineParams,
          resolution,
          generate_audio: generateAudio,
          watermark,
          aspect_ratio: aspectRatio,
          ...(smartMulti ? {} : { duration: effectiveDurationSec }),
        }
      : {
            ...engineParams,
            generate_audio: generateAudio,
            sound: generateAudio,
            ...(refCaps.multiShotsBlocksFirstLast && referenceMode === "first_last"
              ? { multi_shots: false }
              : {}),
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
      style={{
        zIndex: MODAL_Z,
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
              layout="dropdown"
              providerIds={SBV1_DOCK_VIDEO_PROVIDER_IDS}
              allowedModelKeys={[
                ...SBV1_VOLCENGINE_GATEWAY_MODEL_KEYS,
                ...SBV1_DOCK_EXTRA_VIDEO_MODEL_KEYS,
              ]}
              providerId={providerId}
              modelKey={modelKey}
              params={engineParams}
              onChange={(next) => {
                setProviderId(next.providerId);
                setModelKey(next.modelKey);
                setSelectedModel(next.model);
                const p = { ...next.params };
                syncSbv1UiFromModelParams(next.modelKey, p, {
                  setAspectRatio,
                  setDurationSec,
                  setResolution,
                  setGenerateAudio,
                  setReferenceMode,
                  providerId: next.providerId,
                  currentReferenceMode: referenceMode,
                });
                setEngineParams(p);
                const caps = getSbv1VideoModelRefCaps(next.modelKey, {
                  multiShots: p.multi_shots === true,
                  providerId: next.providerId,
                });
                setReferenceMode((cur) => clampSbv1ReferenceMode(cur, caps));
              }}
            />
          </div>

          {isMotionControl ? (
            <p className="rounded border border-white/10 bg-white/[.03] px-2.5 py-2 text-[11px] leading-snug text-white/55">
              动作控制需连接参考图（in_ref）与驱动动作视频（左侧 + ·
              视频 → 动作视频口）。参数随模型变化见下方。
            </p>
          ) : null}

          {showGatewayReferenceMode ? (
            <LabeledSegment
              label="参考模式"
              options={referenceModeOptions.map((m) => ({
                id: m.id,
                label: m.label,
              }))}
              value={referenceMode}
              onChange={(id) => {
                const mode = id as Sbv1ReferenceMode;
                setReferenceMode(mode);
                if (mode === "first_last" && refCaps.multiShotsBlocksFirstLast) {
                  setEngineParams((p) => ({ ...p, multi_shots: false }));
                }
              }}
            />
          ) : null}

          {refCaps.multiShotsBlocksFirstLast && klingMultiShots ? (
            <p className="text-[11px] leading-snug text-white/45">
              已开启多镜头：仅支持首帧；首尾帧请关闭「多镜头」后再选参考模式。
            </p>
          ) : null}

          {referenceMode === "first_last" &&
          refCaps.supportedModes.includes("first_last") ? (
            <p className="text-[11px] leading-snug text-white/45">
              首尾帧：Dock 按连线顺序自动标注首帧 / 尾帧；百炼 R2V 取前 2 张，可灵 / 万相 i2v 走 API 首尾槽。
            </p>
          ) : null}

          {isVolcDockModel ? (
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
          ) : null}

          {isVolcDockModel ? (
          <>
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
              onChange={(v) => {
                setGenerateAudio(v);
                setEngineParams((p) => ({
                  ...p,
                  generate_audio: v,
                  generateAudio: v,
                  sound: v,
                }));
              }}
            />
            <BooleanSegment
              label="水印"
              value={watermark}
              onChange={setWatermark}
            />
          </div>
          </>
          ) : (
            <>
              {resolvedModel?.paramsSchema &&
              resolvedModel.paramsSchema.length > 0 ? (
                <DynamicParamForm
                  variant="panel"
                  schema={resolvedModel.paramsSchema}
                  value={engineParams}
                  onChange={(next) => {
                    setEngineParams(next);
                    if (
                      refCaps.multiShotsBlocksFirstLast &&
                      next.multi_shots === true
                    ) {
                      setReferenceMode("omni");
                    }
                  }}
                />
              ) : null}
              <BooleanSegment
                label="生成音频"
                value={generateAudio}
                onChange={(v) => {
                  setGenerateAudio(v);
                  setEngineParams((p) => ({
                    ...p,
                    generate_audio: v,
                    generateAudio: v,
                    sound: v,
                  }));
                }}
              />
            </>
          )}
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
          ? "border-white/30 bg-white/[.04] text-white"
          : "border-white/10 text-white/55 hover:border-white/20 hover:text-white/80",
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

function isSbv1MotionControlModelKey(k: string): boolean {
  return k === "kling-2.6/motion-control" || k === "kling-3.0/motion-control";
}

function syncSbv1UiFromModelParams(
  modelKey: string,
  p: Record<string, unknown>,
  setters: {
    setAspectRatio: (v: Sbv1AspectRatio) => void;
    setDurationSec: (v: number) => void;
    setResolution: (v: "720p" | "1080p") => void;
    setGenerateAudio: (v: boolean) => void;
    setReferenceMode: (v: Sbv1ReferenceMode) => void;
    providerId?: string;
    currentReferenceMode?: Sbv1ReferenceMode;
  },
) {
  const res = p.resolution;
  if (typeof res === "string") {
    const rl = res.toLowerCase();
    if (rl === "720p" || rl === "1080p") setters.setResolution(rl);
  }
  const dur = Number(p.duration);
  if (Number.isFinite(dur) && dur >= 3 && dur <= 15) {
    setters.setDurationSec(Math.round(dur));
  }
  const ar = p.aspect_ratio ?? p.ratio;
  if (
    typeof ar === "string" &&
    (SBV1_ASPECT_RATIOS as readonly string[]).includes(ar)
  ) {
    setters.setAspectRatio(ar as Sbv1AspectRatio);
  }
  const audio = p.generate_audio ?? p.generateAudio ?? p.sound;
  if (audio !== undefined) setters.setGenerateAudio(audio !== false);
  if (isSbv1MotionControlModelKey(modelKey)) {
    setters.setReferenceMode("omni");
  }
  const caps = getSbv1VideoModelRefCaps(modelKey, {
    multiShots: p.multi_shots === true,
    providerId: setters.providerId,
  });
  if (p.multi_shots === true && caps.multiShotsBlocksFirstLast) {
    setters.setReferenceMode("omni");
  }
  if (setters.currentReferenceMode) {
    setters.setReferenceMode(
      clampSbv1ReferenceMode(setters.currentReferenceMode, caps),
    );
  }
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
    // 跨 provider 解析显示名（Volcengine / KIE / 百炼），并隐藏 KIE 厂商名
    let gwName = "";
    for (const p of providers) {
      const gw = p.models.find(
        (m) => m.modelKey.toLowerCase() === engineKey.toLowerCase(),
      );
      if (gw?.displayName) {
        gwName = gw.displayName;
        break;
      }
    }
    const name = hideKieVendorLabel(gwName) || engineKey;
    return `${name}${durationLabel}`;
  }
  const variantId = migrateSbv1ModelVariantId(
    data.volcengineVariantId ?? data.jimengModelId,
  );
  const model = getSbv1VolcengineModelById(variantId, providers);
  if (model?.displayName) return `${model.displayName}${durationLabel}`;
  return "选择模型与参数";
}
