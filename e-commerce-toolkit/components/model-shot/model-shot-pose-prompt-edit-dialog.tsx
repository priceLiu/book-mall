"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { ProductDesignPromptMentionTextarea } from "@/components/product-design/product-design-prompt-mention-textarea";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { EcomDialogCloseButton } from "@/components/ui/dialog";
import {
  ecomModalBackdropMouseDown,
  useEcomModalEscape,
} from "@/components/ui/ecom-modal-layer";
import { buildEcomOssThumbUrl } from "@/lib/ecom-oss-image-url";
import {
  describeModelShotGenRefSlots,
  modelShotImageGenMaxRefs,
  type ModelShotGenRefRole,
} from "@/lib/model-shot-gen-ref-slots";
import { buildModelShotPromptMentionRefs } from "@/lib/model-shot-prompt-mention-refs";
import { PRODUCT_DESIGN_PROMPT_MENTION_FIELD_PROPS } from "@/lib/product-design-prompt-mention-ui";
import type { ModelShotPoseItem, ModelShotProject } from "@/lib/model-shot-types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  project: ModelShotProject;
  item: ModelShotPoseItem;
  imageModelKey: string;
  busy?: boolean;
  onSave: (prompt: string) => void | Promise<void>;
  onSaveAndRegenerate?: (prompt: string) => void | Promise<void>;
};

const SLOT_ROLE_HINT: Record<ModelShotGenRefRole, string> = {
  garment: "服装参考图",
  model: "模特参考",
  scene: "场景参考",
  poseRef: "本姿势库预览",
};

export function ModelShotPosePromptEditDialog({
  open,
  onClose,
  project,
  item,
  imageModelKey,
  busy,
  onSave,
  onSaveAndRegenerate,
}: Props) {
  const [draft, setDraft] = useState(item.prompt ?? "");

  useEffect(() => {
    if (!open) return;
    setDraft(item.prompt ?? "");
  }, [open, item.index, item.prompt]);

  const mentionRefs = useMemo(
    () => buildModelShotPromptMentionRefs(project.references, item, imageModelKey),
    [project.references, item, imageModelKey],
  );

  const genSlots = useMemo(
    () => describeModelShotGenRefSlots({ references: project.references, item, modelKey: imageModelKey }),
    [project.references, item, imageModelKey],
  );

  useEcomModalEscape(open, onClose, { disabled: busy });

  if (!open || typeof document === "undefined") return null;

  const title = item.title?.trim() || `姿势 ${item.index}`;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="model-shot-pose-prompt-edit-title"
      onMouseDown={ecomModalBackdropMouseDown(onClose, { disabled: busy })}
    >
      <div
        className="relative flex max-h-[min(92vh,880px)] w-[min(94vw,56rem)] flex-col rounded-2xl bg-white p-6 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <EcomDialogCloseButton disabled={busy} onClick={onClose} />
        <h3
          id="model-shot-pose-prompt-edit-title"
          className="pr-10 text-lg font-semibold text-[var(--ecom-ink)]"
        >
          {title} · Prompt 编辑
        </h3>
        <p className="mt-1 text-xs text-[var(--ecom-subtle)]">
          顶栏为本次生图会绑定的参考资产；Prompt 内输入 @ 可插入代号。保存后重生成将使用编辑后的 Prompt。
        </p>

        <div className="ecom-scrollbar-thin mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto">
          <section className="rounded-xl border border-[var(--ecom-divider)] bg-[#fafafa] px-3 py-2.5">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-[var(--ecom-muted)]">
              本姿势送入模型（{imageModelKey} · 最多 {genSlots.length} 张）
            </p>
            <ul className="space-y-1.5">
              {genSlots.map((slot, i) => (
                <li key={`${slot.role}-${i}`} className="flex items-center gap-2 text-[11px]">
                  <span className="w-14 shrink-0 font-mono text-[var(--ecom-primary)]">@图片{i + 1}</span>
                  {slot.url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={buildEcomOssThumbUrl(slot.url)}
                      alt=""
                      className="size-9 shrink-0 rounded border border-[var(--ecom-divider)] object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="flex size-9 shrink-0 items-center justify-center rounded border border-dashed border-[var(--ecom-border-soft)] bg-white text-[9px] text-[var(--ecom-subtle)]">
                      文
                    </span>
                  )}
                  <span className="min-w-0 text-[var(--ecom-ink)]">
                    {SLOT_ROLE_HINT[slot.role]} · {slot.label}
                  </span>
                </li>
              ))}
            </ul>
            {describeModelShotGenRefSlots({ references: project.references, item }).length >
            modelShotImageGenMaxRefs(imageModelKey) ? (
              <p className="mt-2 text-[10px] text-amber-800">
                参考图已满额时系统会优先保留服装、模特、场景，可能省略姿势预览图。
              </p>
            ) : null}
          </section>

          <ProductDesignPromptMentionTextarea
            {...PRODUCT_DESIGN_PROMPT_MENTION_FIELD_PROPS}
            referenceImages={mentionRefs}
            value={draft}
            onChange={setDraft}
            disabled={busy}
            minHeightClass="min-h-[200px]"
            className={cn("w-full")}
            refBarHint="参考资产 · Prompt 中 @ 引用（与上方生图顺序一致）"
          />

        </div>

        <div className="mt-4 flex shrink-0 flex-wrap justify-end gap-2 border-t border-[var(--ecom-divider)] pt-4">
          <EcomButtonSecondary type="button" disabled={busy} onClick={onClose}>
            取消
          </EcomButtonSecondary>
          <EcomButtonSecondary
            type="button"
            disabled={busy || !draft.trim()}
            onClick={() => void Promise.resolve(onSave(draft.trim())).then(onClose)}
          >
            保存
          </EcomButtonSecondary>
          {onSaveAndRegenerate ? (
            <EcomButtonPrimary
              type="button"
              disabled={busy || !draft.trim()}
              onClick={() =>
                void (async () => {
                  await onSaveAndRegenerate(draft.trim());
                  onClose();
                })()
              }
            >
              {busy ? "处理中…" : "保存并重生成"}
            </EcomButtonPrimary>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}