"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImageIcon, X } from "lucide-react";
import { EnginePicker } from "@/components/canvas/engine-picker";
import {
  useClientPortalMounted,
  useModalBodyScrollLock,
  useModalEscapeClose,
} from "@/lib/canvas/use-modal-portal-effects";
import type { Pro2WizardAssetKind } from "@/lib/canvas/pro2-production-wizard-assets";
import { PRO2_CHARACTER_IMAGE_MODEL_KEYS } from "@/lib/canvas/pro2-three-view-engine";
import { PRO2_SCENE_IMAGE_MODEL_KEYS } from "@/lib/canvas/pro2-scene-batch-image";
import { LIBTV_GENERATE_SETTINGS_MODAL_Z } from "@/lib/canvas/libtv-generate-settings-modal-z";
import { ENGINE_PICKER_MODAL_BG } from "@/lib/canvas/gateway-model-role";

const KIND_LABEL: Record<Pro2WizardAssetKind, string> = {
  character: "角色",
  scene: "场景",
  prop: "道具",
};

function allowedKeysForKind(kind: Pro2WizardAssetKind): string[] {
  if (kind === "character") return [...PRO2_CHARACTER_IMAGE_MODEL_KEYS];
  return [...PRO2_SCENE_IMAGE_MODEL_KEYS];
}

export type Pro2ProductionWizardImageModelModalProps = {
  open: boolean;
  kind: Pro2WizardAssetKind;
  title: string;
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

export function Pro2ProductionWizardImageModelModal({
  open,
  kind,
  title,
  providerId,
  modelKey,
  params,
  onClose,
  onConfirm,
}: Pro2ProductionWizardImageModelModalProps) {
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
    setDraftParams(d.params ?? {});
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
      aria-label={`${KIND_LABEL[kind]}图片模型`}
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
          <div>
            <p className="flex items-center gap-2 text-[14px] font-medium text-white">
              <ImageIcon className="size-4 text-violet-400" />
              {title} · 图片模型
            </p>
            <p className="mt-0.5 text-[11px] text-white/45">
              {KIND_LABEL[kind]}出图 · Gateway IMAGE 模型
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

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <EnginePicker
            role="IMAGE"
            embedded
            modelsOnly
            allowedModelKeys={allowedKeysForKind(kind)}
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
            className="rounded-md bg-violet-600 px-4 py-1.5 text-[12px] font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            确认
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
