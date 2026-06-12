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
  estimateSbv1ListCostYuan,
  getSbv1VolcengineModelById,
  migrateSbv1ModelVariantId,
  resolveSbv1VariantIdFromEngine,
} from "@/lib/canvas/sbv1-video-models";
import type {
  Sbv1AspectRatio,
  Sbv1ReferenceMode,
  Sbv1VideoEngineNodeData,
} from "@/lib/canvas/sbv1-workspace-types";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { cn } from "@/lib/utils";

const MODAL_Z = 1200;

export type Sbv1VideoGenerateSettingsModalProps = {
  open: boolean;
  data: Sbv1VideoEngineNodeData;
  onClose: () => void;
  onConfirm: (patch: Partial<Sbv1VideoEngineNodeData>) => void;
};

/** 分镜视频 1.0 · 模型 + 参考模式 / 比例 / 时长 / 分辨率（单弹层，对齐 Pro2 EnginePicker） */
export function Sbv1VideoGenerateSettingsModal({
  open,
  data,
  onClose,
  onConfirm,
}: Sbv1VideoGenerateSettingsModalProps) {
  const { providers } = useUserProviders();
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

  const smartMulti = referenceMode === "smart_multi";

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

  const estCostYuan = useMemo(() => {
    const variantId = resolveSbv1VariantIdFromEngine(
      { providerId, modelKey, params: engineParams },
      providers,
    );
    const model = getSbv1VolcengineModelById(variantId, providers);
    return estimateSbv1ListCostYuan({
      listCostYuanPerSec: model.listCostYuanPerSec,
      durationSec: smartMulti && durationSec <= 0 ? 4 : durationSec,
    });
  }, [
    providerId,
    modelKey,
    engineParams,
    providers,
    smartMulti,
    durationSec,
  ]);

  if (!mounted || !open) return null;

  const handleConfirm = () => {
    if (!providerId.trim() || !modelKey.trim()) return;
    const engine = {
      providerId,
      modelKey,
      params: {
        ...engineParams,
        ...(smartMulti ? { resolution } : {}),
        ...(!smartMulti && durationSec >= 4
          ? { duration: durationSec }
          : {}),
      },
    };
    const variantId = resolveSbv1VariantIdFromEngine(engine, providers);
    onConfirm({
      referenceMode,
      aspectRatio,
      durationSec: smartMulti ? 0 : durationSec,
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
        className="nodrag nowheel flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--canvas-surface,#161427)] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/5 px-5 py-4">
          <div>
            <p className="flex items-center gap-2 text-[15px] font-medium text-white">
              <Sparkles className="size-4 text-[var(--canvas-accent,#a78bfa)]" />
              视频生成设置
            </p>
            <p className="mt-0.5 text-[12px] text-white/60">
              选择火山 Seedance 模型并调整参考模式、比例与时长。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-7 shrink-0 place-items-center rounded-md text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="mb-3 text-[12px] font-medium text-white">生成参数</p>
            <div className="space-y-4">
              <Field label="参考模式">
                <SegmentRow
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
                      setDurationSec(5);
                    }
                  }}
                />
              </Field>

              <Field label="画面比例">
                <SegmentRow
                  options={SBV1_ASPECT_RATIOS.map((r) => ({
                    id: r,
                    label: r,
                  }))}
                  value={aspectRatio}
                  onChange={(id) => setAspectRatio(id as Sbv1AspectRatio)}
                />
              </Field>

              {smartMulti ? (
                <Field label="分辨率">
                  <SegmentRow
                    options={[
                      { id: "720p", label: "720P" },
                      { id: "1080p", label: "1080P" },
                    ]}
                    value={resolution}
                    onChange={(id) => {
                      setResolution(id as "720p" | "1080p");
                      setEngineParams((p) => ({ ...p, resolution: id }));
                    }}
                  />
                </Field>
              ) : (
                <Field label="时长（秒）">
                  <SegmentRow
                    options={[4, 5, 6, 7, 8, 9, 10, 12, 15].map((n) => ({
                      id: String(n),
                      label: `${n}s`,
                    }))}
                    value={String(durationSec)}
                    onChange={(id) => {
                      const n = Number(id);
                      setDurationSec(n);
                      setEngineParams((p) => ({ ...p, duration: n }));
                    }}
                  />
                </Field>
              )}

              <Field label="音频">
                <SegmentRow
                  options={[
                    { id: "off", label: "无声" },
                    { id: "on", label: "有声" },
                  ]}
                  value={Boolean(engineParams.generate_audio) ? "on" : "off"}
                  onChange={(id) => {
                    const generate_audio = id === "on";
                    setEngineParams((p) => ({ ...p, generate_audio }));
                  }}
                />
              </Field>
            </div>
          </section>

          <section>
            <p className="mb-2 text-[12px] font-medium text-white">视频模型</p>
            <EnginePicker
              role="VIDEO"
              embedded
              providerIds={[GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID]}
              providerId={providerId}
              modelKey={modelKey}
              params={engineParams}
              onChange={(next) => {
                setProviderId(next.providerId);
                setModelKey(next.modelKey);
                setEngineParams(next.params);
              }}
            />
          </section>

          {estCostYuan != null ? (
            <p className="text-[11px] text-white/45">
              估算 ≈¥{estCostYuan.toFixed(2)}（火山 BYOK · 挂牌参考）
            </p>
          ) : null}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-white/5 bg-black/20 px-5 py-3">
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
            className="rounded-md bg-[var(--canvas-accent,#a78bfa)] px-4 py-1.5 text-[12px] font-medium text-black hover:bg-[var(--canvas-accent-soft,#c4b5fd)] disabled:opacity-50"
          >
            确认
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] text-white/50">{label}</p>
      {children}
    </div>
  );
}

function SegmentRow({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={cn(
            "rounded-md border px-2.5 py-1 text-[11px] transition",
            opt.id === value
              ? "border-[var(--canvas-accent,#a78bfa)] bg-[var(--canvas-accent,#a78bfa)]/15 text-white"
              : "border-white/10 text-white/70 hover:border-white/25 hover:text-white",
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
  const engineKey = data.engine?.modelKey?.trim();
  if (engineKey) {
    const sbv1 = providers.find(
      (p) => p.id === GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID,
    );
    const gw = sbv1?.models.find(
      (m) => m.modelKey.toLowerCase() === engineKey.toLowerCase(),
    );
    if (gw?.displayName?.trim()) return gw.displayName.trim();
    return engineKey;
  }
  const variantId = migrateSbv1ModelVariantId(
    data.volcengineVariantId ?? data.jimengModelId,
  );
  const model = getSbv1VolcengineModelById(variantId, providers);
  if (model?.displayName) return model.displayName;
  return "选择模型与参数";
}
