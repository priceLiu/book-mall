"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { MentionsEditable } from "@/components/canvas/mentions/MentionsEditable";
import {
  useClientPortalMounted,
  useModalBodyScrollLock,
  useModalEscapeClose,
} from "@/lib/canvas/use-modal-portal-effects";
import type { Pro2WizardAssetKind } from "@/lib/canvas/pro2-production-wizard-assets";
import {
  buildWizardAssetMentionables,
  defaultWizardAssetPrompt,
} from "@/lib/canvas/pro2-production-wizard-assets";
import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";
import type { StoryRefImage } from "@/lib/canvas/story-ref-image";
import { RF_FORM_CONTROL, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import { LIBTV_GENERATE_SETTINGS_MODAL_Z } from "@/lib/canvas/libtv-generate-settings-modal-z";
import { ENGINE_PICKER_MODAL_BG } from "@/lib/canvas/gateway-model-role";
import { Pro2WizardRefImageZone } from "./pro2-wizard-ref-image-zone";
import {
  PRO2_WIZARD_MENTIONS_CLASS,
} from "./pro2-production-wizard-chrome";
import { cn } from "@/lib/utils";

export type Pro2ProductionWizardPromptModalProps = {
  open: boolean;
  onClose: () => void;
  kind: Pro2WizardAssetKind;
  assetId: string;
  title: string;
  script?: Pro2ProductionScript;
  initialPrompt: string;
  initialRefImages: StoryRefImage[];
  onSave: (patch: { prompt: string; refImages: StoryRefImage[] }) => void;
};

const KIND_LABEL: Record<Pro2WizardAssetKind, string> = {
  character: "角色",
  scene: "场景",
  prop: "道具",
};

export function Pro2ProductionWizardPromptModal({
  open,
  onClose,
  kind,
  assetId,
  title,
  script,
  initialPrompt,
  initialRefImages,
  onSave,
}: Pro2ProductionWizardPromptModalProps) {
  const mounted = useClientPortalMounted();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [refImages, setRefImages] = useState(initialRefImages);

  useEffect(() => {
    if (!open) return;
    setPrompt(initialPrompt);
    setRefImages(initialRefImages);
  }, [open, initialPrompt, initialRefImages]);

  useModalBodyScrollLock(open);
  useModalEscapeClose(onClose, { active: open });

  const mentionables = useMemo(
    () =>
      buildWizardAssetMentionables(script, refImages, {
        kind,
        assetId,
      }),
    [script, refImages, kind, assetId],
  );

  const onConfirm = useCallback(() => {
    onSave({ prompt: prompt.trim(), refImages });
    onClose();
  }, [onClose, onSave, prompt, refImages]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      style={{
        zIndex: LIBTV_GENERATE_SETTINGS_MODAL_Z,
        isolation: "isolate",
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`编辑${KIND_LABEL[kind]}提示词`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="nodrag nowheel flex h-[50vh] w-[50vw] min-h-[360px] min-w-[360px] max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-white/[0.08] shadow-2xl"
        style={{ backgroundColor: ENGINE_PICKER_MODAL_BG }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-white">{title}</p>
            <p className="truncate text-[10px] text-white/45">
              {KIND_LABEL[kind]} · 参考图 + 提示词（@ 引用）
            </p>
          </div>
          <button
            type="button"
            className="grid size-7 shrink-0 place-items-center rounded-md text-white/50 hover:bg-white/8 hover:text-white"
            aria-label="关闭"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
          <section className="shrink-0">
            <p className="mb-1.5 text-[10px] font-medium text-white/55">参考图</p>
            <Pro2WizardRefImageZone
              refs={refImages}
              onChange={setRefImages}
              maxCount={9}
            />
          </section>
          <section className="flex min-h-0 flex-1 flex-col">
            <p className="mb-1.5 shrink-0 text-[10px] font-medium text-white/55">
              提示词
            </p>
            <MentionsEditable
              className={cn(
                RF_FORM_CONTROL,
                RF_NO_WHEEL,
                PRO2_WIZARD_MENTIONS_CLASS,
                "min-h-[120px] flex-1",
              )}
              placeholder="输入生图提示词，@ 引用角色 / 场景 / 道具或参考图"
              value={prompt}
              mentionables={mentionables}
              mentionEdition="wizard"
              onChange={(value) => setPrompt(value)}
            />
          </section>
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-white/[0.06] px-4 py-2.5">
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-[12px] text-white/55 hover:bg-white/6"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            className="rounded-md bg-violet-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-violet-500"
            onClick={onConfirm}
          >
            保存
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

export function resolveWizardAssetDefaultPrompt(
  kind: Pro2WizardAssetKind,
  assetId: string,
  script?: Pro2ProductionScript,
): string {
  if (!script) return "";
  if (kind === "character") {
    const hit = script.characters?.find((c) => c.id === assetId);
    return hit ? defaultWizardAssetPrompt(kind, hit) : "";
  }
  if (kind === "scene") {
    const hit = script.scenes?.find((s) => s.id === assetId);
    return hit ? defaultWizardAssetPrompt(kind, hit) : "";
  }
  const hit = script.props?.find((p) => p.id === assetId);
  return hit ? defaultWizardAssetPrompt(kind, hit) : "";
}
