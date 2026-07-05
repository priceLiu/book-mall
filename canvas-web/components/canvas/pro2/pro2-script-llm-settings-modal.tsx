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
import type { CanvasProviderDto } from "@/lib/canvas-providers-api";
import { STORY_LLM_MODEL_KEYS } from "@/lib/canvas/types";
import { STORY_PRO_LLM_PARAMS_DEFAULT } from "@/lib/canvas/story-pro-prompts";
import { LIBTV_GENERATE_SETTINGS_MODAL_Z } from "@/lib/canvas/libtv-generate-settings-modal-z";
import { hideKieVendorLabel } from "@/lib/canvas/gateway-model-role";

export type Pro2ScriptLlmSettingsModalProps = {
  open: boolean;
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
  onClose: () => void;
  onConfirm: (next: {
    providerId: string;
    modelKey: string;
    params: Record<string, unknown>;
  }) => void;
};

/** 2.0 脚本节点 · LLM 模型设置（与视频/图片生成设置弹层同构） */
export function Pro2ScriptLlmSettingsModal({
  open,
  providerId,
  modelKey,
  params,
  onClose,
  onConfirm,
}: Pro2ScriptLlmSettingsModalProps) {
  const mounted = useClientPortalMounted();
  useModalBodyScrollLock(open);
  useModalEscapeClose(onClose, { active: open });

  const [draftProviderId, setDraftProviderId] = useState(providerId);
  const [draftModelKey, setDraftModelKey] = useState(modelKey);
  const [draftParams, setDraftParams] = useState(params);
  const dataRef = useRef({ providerId, modelKey, params });
  dataRef.current = { providerId, modelKey, params };

  useEffect(() => {
    if (!open) return;
    const d = dataRef.current;
    setDraftProviderId(d.providerId);
    setDraftModelKey(d.modelKey);
    setDraftParams(d.params ?? { ...STORY_PRO_LLM_PARAMS_DEFAULT });
  }, [open]);

  if (!mounted || !open) return null;

  const handleConfirm = () => {
    if (!draftProviderId.trim() || !draftModelKey.trim()) return;
    onConfirm({
      providerId: draftProviderId,
      modelKey: draftModelKey,
      params: draftParams,
    });
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      style={{
        zIndex: LIBTV_GENERATE_SETTINGS_MODAL_Z,
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
        className="nodrag nowheel flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--canvas-surface,#161427)] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/5 px-4 py-3">
          <p className="flex items-center gap-2 text-[14px] font-medium text-white">
            <Sparkles className="size-4 text-[var(--canvas-accent)]" />
            文本模型设置
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
              role="LLM"
              embedded
              modelsOnly
              allowedModelKeys={[...STORY_LLM_MODEL_KEYS]}
              providerId={draftProviderId}
              modelKey={draftModelKey}
              params={draftParams}
              onChange={(next) => {
                setDraftProviderId(next.providerId);
                setDraftModelKey(next.modelKey);
                setDraftParams(next.params);
              }}
            />
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-white/5 bg-black/20 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-white/80 hover:border-white/30 hover:text-white"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!draftProviderId.trim() || !draftModelKey.trim()}
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

/** Dock 底栏触发文案 */
export function pro2ScriptLlmSettingsTriggerLabel(
  providerId: string,
  modelKey: string,
  providers: CanvasProviderDto[],
): string {
  const key = modelKey.trim();
  if (key) {
    for (const provider of providers) {
      const model = provider.models.find(
        (m) => m.modelKey.toLowerCase() === key.toLowerCase(),
      );
      const name = model?.displayName?.trim();
      if (name) return name;
    }
    if (providerId.trim()) {
      const provider = providers.find((p) => p.id === providerId);
      if (provider) {
        return `${hideKieVendorLabel(provider.alias)} · ${key}`;
      }
    }
    return key;
  }
  return "选择文本模型";
}
