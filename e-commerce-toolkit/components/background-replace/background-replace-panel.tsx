"use client";

import { useEffect, useMemo } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";

import { RefImageBboxPicker } from "@/components/background-replace/ref-image-bbox-picker";
import { ProductDesignPromptMentionTextarea } from "@/components/product-design/product-design-prompt-mention-textarea";
import { EcomButtonPrimary } from "@/components/ui/ecom-button";
import {
  BACKGROUND_REPLACE_DUAL_BBOX_EXAMPLE,
  BACKGROUND_REPLACE_SUBJECT_BBOX_EXAMPLE,
  buildBackgroundReplaceMentionRefs,
} from "@/lib/background-replace-mentions";
import {
  canSubmitBackgroundReplace,
  type BackgroundReplaceFormState,
} from "@/lib/background-replace-types";
import { cn } from "@/lib/utils";

type Props = {
  form: BackgroundReplaceFormState;
  busy: boolean;
  hasBase: boolean;
  subjectHint?: string;
  subjectImageUrl?: string;
  subjectBbox?: [number, number, number, number] | null;
  onChange: (next: BackgroundReplaceFormState) => void;
  onUploadRefImage: (file: File) => Promise<string>;
  onSubmit: () => void;
};

function bboxHint(opts: {
  hasSubjectBbox: boolean;
  hasRefBbox: boolean;
}): string {
  if (opts.hasSubjectBbox && opts.hasRefBbox) {
    return `已框选图 1、图 2 主体。场景描述即官方编辑指令，可输入 @ 引用框选：${BACKGROUND_REPLACE_DUAL_BBOX_EXAMPLE}。`;
  }
  if (opts.hasSubjectBbox) {
    return `已框选图 1 主体。输入 @ 引用该框，例如：${BACKGROUND_REPLACE_SUBJECT_BBOX_EXAMPLE}。`;
  }
  if (opts.hasRefBbox) {
    return "已框选图 2 区域。输入 @ 引用该框，例如：将图 1 的主体放到 @图2框选 位置。";
  }
  return "未框选：按整图提示词换景。可在右侧画布拖出框。";
}

export function BackgroundReplacePanel({
  form,
  busy,
  hasBase,
  subjectHint,
  subjectImageUrl,
  subjectBbox = null,
  onChange,
  onUploadRefImage,
  onSubmit,
}: Props) {
  const canSubmit = canSubmitBackgroundReplace(form, hasBase);
  const hasSubjectBbox = Boolean(subjectBbox);
  const hasRefBbox = Boolean(form.refBbox);
  const mentionRefs = useMemo(
    () =>
      buildBackgroundReplaceMentionRefs({
        subjectImageUrl,
        subjectBbox,
        refImageUrl: form.refImageUrl,
        refBbox: form.refBbox,
      }),
    [form.refBbox, form.refImageUrl, subjectBbox, subjectImageUrl],
  );

  useEffect(() => {
    if (!subjectBbox || !form.refBbox) return;
    if (form.refPrompt.trim()) return;
    onChange({ ...form, refPrompt: BACKGROUND_REPLACE_DUAL_BBOX_EXAMPLE });
  }, [form, onChange, subjectBbox]);
  const scenePlaceholder =
    hasSubjectBbox && hasRefBbox
      ? BACKGROUND_REPLACE_DUAL_BBOX_EXAMPLE
      : hasSubjectBbox
        ? BACKGROUND_REPLACE_SUBJECT_BBOX_EXAMPLE
        : "例如：咖啡馆暖光、大理石桌面（有参考图时可空）";

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-[#6b7280]">
        {subjectHint ??
          "火山 Seedream 5.0 Pro：可在右侧框选再换，也可只写场景；上传参考图则按图 1 + 图 2 编辑。"}
      </p>
      <p className="rounded-lg bg-[#f0f6ff] px-2.5 py-1.5 text-[11px] leading-5 text-[#374151]">
        {bboxHint({ hasSubjectBbox, hasRefBbox })}
      </p>

      <div className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-[#374151]">场景描述</span>
        {mentionRefs.length > 0 ? (
          <ProductDesignPromptMentionTextarea
            value={form.refPrompt}
            disabled={busy}
            referenceImages={mentionRefs}
            onChange={(refPrompt) => onChange({ ...form, refPrompt })}
            minHeightClass="min-h-[5.5rem]"
            mentionBadgeVariant="thumbnail"
            showTopRefBar
            refBarHint="点缩略图或输入 @ 插入框选"
          />
        ) : (
          <textarea
            rows={3}
            disabled={busy}
            value={form.refPrompt}
            placeholder={scenePlaceholder}
            onChange={(e) => onChange({ ...form, refPrompt: e.target.value })}
            className="w-full resize-none rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm"
          />
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs font-medium text-[#374151]">参考图（图 2，可选）</p>
          {form.refImageUrl ? (
            <button
              type="button"
              disabled={busy}
              className="inline-flex items-center gap-1 text-[11px] text-[#ff3b30] disabled:opacity-50"
              onClick={() => onChange({ ...form, refImageUrl: "", refBbox: null })}
            >
              <X className="h-3 w-3" />
              移除
            </button>
          ) : null}
        </div>
        <label
          className={cn(
            "flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#d2d2d7] px-3 py-2 text-xs text-[#6b7280]",
            busy && "pointer-events-none opacity-60",
          )}
        >
          <ImagePlus className="h-4 w-4" />
          {form.refImageUrl ? "已选参考图，点击更换" : "上传场景 / 构图参考"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void onUploadRefImage(file).then((url) =>
                onChange({ ...form, refImageUrl: url, refBbox: null }),
              );
            }}
          />
        </label>
        {form.refImageUrl ? (
          <div className="mt-2">
            <RefImageBboxPicker
              url={form.refImageUrl}
              bbox={form.refBbox}
              disabled={busy}
              onChange={(refBbox) => onChange({ ...form, refBbox })}
            />
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-0 border-t border-[#e5e7eb] bg-white pt-3">
        <EcomButtonPrimary
          type="button"
          fullWidth
          className="!max-w-none"
          disabled={busy || !canSubmit}
          onClick={onSubmit}
        >
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          生成
        </EcomButtonPrimary>
      </div>
    </div>
  );
}
