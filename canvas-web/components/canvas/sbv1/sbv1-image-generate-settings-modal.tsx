"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X } from "lucide-react";
import {
  useClientPortalMounted,
  useModalBodyScrollLock,
  useModalEscapeClose,
} from "@/lib/canvas/use-modal-portal-effects";
import {
  Sbv1ImageDockModelPicker,
  Sbv1ImageDockParamsPicker,
} from "./sbv1-image-dock-pickers";
import { LibtvToolbarDropdownZProvider } from "./sbv1-toolbar-anchor-popover";
import {
  LIBTV_DOCK_TOOLBAR_SCREEN_SCALE,
  LibtvDockToolbarMetricsContext,
} from "@/lib/canvas/use-libtv-dock-toolbar-metrics";
import type { Sbv1ImageNodeData } from "@/lib/canvas/sbv1-workspace-types";
import { ENGINE_PICKER_MODAL_BG } from "@/lib/canvas/gateway-model-role";

import { LIBTV_GENERATE_SETTINGS_MODAL_Z } from "@/lib/canvas/libtv-generate-settings-modal-z";

const MODAL_Z = LIBTV_GENERATE_SETTINGS_MODAL_Z;

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

/** 分镜视频 1.0 · 图片模型 + 参数（与节点 Dock 同款双下拉） */
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

  const [draft, setDraft] = useState<Sbv1ImageNodeData>(data);
  const [dockMenu, setDockMenu] = useState<"model" | "params" | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    if (!open) return;
    setDraft(dataRef.current);
    setDockMenu(null);
  }, [open]);

  const onPatch = useCallback((patch: Partial<Sbv1ImageNodeData>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  if (!mounted || !open) return null;

  const providerId = draft.engine?.providerId?.trim() ?? "";
  const modelKey = draft.engine?.modelKey?.trim() ?? "";
  const hasModel = Boolean(providerId && modelKey);

  const handleConfirm = () => {
    if (!hasModel) return;
    onConfirm({
      imageQuality: draft.imageQuality,
      resolution: draft.resolution,
      aspectRatio: draft.aspectRatio,
      outputCount: draft.outputCount,
      engine: draft.engine,
    });
    onClose();
  };

  return createPortal(
    <LibtvToolbarDropdownZProvider zIndex={modalZIndex + 10}>
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
          className="nodrag nowheel flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
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

          <div className="px-4 py-3">
            <LibtvDockToolbarMetricsContext.Provider
              value={LIBTV_DOCK_TOOLBAR_SCREEN_SCALE}
            >
              <div className="flex min-w-0 flex-nowrap items-center gap-0.5 overflow-x-auto rounded-xl border border-white/10 bg-black/25 px-1 py-1">
                <Sbv1ImageDockModelPicker
                  data={draft}
                  allowedModelKeys={allowedModelKeys}
                  open={dockMenu === "model"}
                  onOpenChange={(next) => setDockMenu(next ? "model" : null)}
                  onPatch={onPatch}
                />
                <Sbv1ImageDockParamsPicker
                  data={draft}
                  open={dockMenu === "params"}
                  onOpenChange={(next) => setDockMenu(next ? "params" : null)}
                  onPatch={onPatch}
                />
              </div>
            </LibtvDockToolbarMetricsContext.Provider>
            {!hasModel ? (
              <p className="mt-2 text-[11px] text-amber-200/90">
                请先选择图片模型，再调整参数
              </p>
            ) : null}
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
              disabled={!hasModel}
              onClick={handleConfirm}
              className="rounded-md bg-[var(--canvas-accent)] px-4 py-1.5 text-[12px] font-medium text-white hover:bg-[var(--canvas-accent-soft)] disabled:opacity-50"
            >
              确认
            </button>
          </footer>
        </div>
      </div>
    </LibtvToolbarDropdownZProvider>,
    document.body,
  );
}

/** Dock 底栏触发文案（兼容旧引用） */
export {
  sbv1ImageModelTriggerLabel,
  sbv1ImageParamsTriggerLabel,
  sbv1ImageSettingsTriggerLabel,
  buildSbv1ImageEngineSettingsPatch,
} from "./sbv1-image-dock-pickers";
