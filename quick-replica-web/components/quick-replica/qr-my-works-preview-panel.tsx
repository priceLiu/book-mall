"use client";

import { Copy, Trash2 } from "lucide-react";

import { QrAudioGenerateSuccess } from "@/components/quick-replica/qr-audio-generate-preview";
import { getKindDef, templateToWorkspaceDraft, type QrCategory, type QrTemplate } from "@/lib/qr-template-types";
import { isAudioMediaUrl, isVideoMediaUrl } from "@/lib/qr-template-preview-media";

type Props = {
  category: QrCategory;
  template: QrTemplate | null;
  onSelectTemplate: (template: QrTemplate) => void;
  onCopy: (template: QrTemplate) => void;
  onDelete?: (template: QrTemplate) => void;
};

function isAudioTemplate(template: QrTemplate): boolean {
  return (
    template.category === "audio" ||
    template.output?.mediaType === "audio" ||
    template.reference.model.role === "AUDIO" ||
    Boolean(template.output?.url && isAudioMediaUrl(template.output.url))
  );
}

export function QrMyWorksPreviewPanel({
  category,
  template,
  onCopy,
  onDelete,
}: Props) {
  if (!template) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <p className="text-sm text-[var(--qr-text-secondary)]">
          点击右侧卡片在此预览；可复制到工作区继续编辑
        </p>
      </div>
    );
  }

  const kindDef = getKindDef(template.kind);
  const outputUrl = template.output?.url?.trim() ?? "";
  const isAudio = isAudioTemplate(template);
  const isVideo =
    !isAudio &&
    (template.output?.mediaType === "video" ||
      template.reference.model.role === "VIDEO" ||
      isVideoMediaUrl(outputUrl));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-white/10 px-4 py-3">
        <p className="text-sm font-medium text-[var(--qr-text-primary)]">{template.title}</p>
        <p className="mt-0.5 text-[11px] text-[var(--qr-text-muted)]">
          {kindDef?.label ?? template.kind} · {template.reference.model.modelKey}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isAudio && outputUrl ? (
          <QrAudioGenerateSuccess
            draft={templateToWorkspaceDraft(template)}
            outputUrl={outputUrl}
          />
        ) : outputUrl ? (
          <div className="overflow-hidden rounded-xl bg-black">
            {isVideo ? (
              <video src={outputUrl} controls playsInline className="max-h-[min(50vh,480px)] w-full object-contain" />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={outputUrl} alt={template.title} className="max-h-[min(50vh,480px)] w-full object-contain" />
            )}
          </div>
        ) : (
          <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-white/10">
            <p className="text-xs text-[var(--qr-text-muted)]">暂无产出预览</p>
          </div>
        )}
      </div>

      <div className="flex shrink-0 gap-2 border-t border-white/10 p-4">
        <button type="button" className="qr-btn-primary flex flex-1 items-center justify-center gap-2" onClick={() => onCopy(template)}>
          <Copy className="h-4 w-4" />
          复制到工作区
        </button>
        {onDelete && template.source === "user" ? (
          <button
            type="button"
            className="qr-btn-secondary text-red-300"
            onClick={() => onDelete(template)}
            aria-label="删除"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
