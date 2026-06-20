"use client";

import { useState } from "react";
import { Copy, X } from "lucide-react";

import { QrModal } from "@/components/quick-replica/qr-modal";
import { getKindDef, type QrTemplate } from "@/lib/qr-template-types";

type Props = {
  template: QrTemplate | null;
  open: boolean;
  canManageFeatured: boolean;
  onClose: () => void;
  onCopy: (template: QrTemplate) => void;
  onFeaturedUpdated?: () => void;
};

function resolveAspectRatioLabel(template: QrTemplate): string {
  const params = template.reference.model.params;
  const raw = params.aspect_ratio ?? params.aspectRatio ?? params.ratio;
  if (typeof raw === "string" && raw.includes(":")) return raw;
  if (typeof raw === "string" && /^\d+x\d+$/i.test(raw)) {
    return raw.replace("x", ":");
  }
  if (template.reference.model.role === "VIDEO") return "16:9";
  return "1:1";
}

function resolvePreviewMedia(template: QrTemplate): {
  url: string;
  isVideo: boolean;
} {
  const isVideo =
    template.output?.mediaType === "video" ||
    template.reference.model.role === "VIDEO";
  const url =
    template.output?.url ||
    (isVideo ? template.reference.slots.referenceVideo?.url : undefined) ||
    template.thumbnailUrl;
  return { url, isVideo: Boolean(isVideo && template.output?.url) || isVideo };
}

export function QrTemplatePreviewModal({
  template,
  open,
  canManageFeatured,
  onClose,
  onCopy,
  onFeaturedUpdated,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [promptExpanded, setPromptExpanded] = useState(false);

  if (!template) return null;

  const kindDef = getKindDef(template.kind);
  const aspectLabel = resolveAspectRatioLabel(template);
  const { url: previewUrl, isVideo } = resolvePreviewMedia(template);
  const promptText = template.reference.prompt.text;
  const promptPreview =
    promptExpanded || promptText.length <= 280
      ? promptText
      : `${promptText.slice(0, 280)}…`;

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
    } catch {
      /* ignore */
    }
  };

  const setFeatured = async (makePublic: boolean) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/book-mall/api/platform/v1/quick-replica/admin/kinds/${encodeURIComponent(template.kind)}/featured`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId: template.id,
            templateSource: template.source,
            makePublic,
          }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "设置失败");
      }
      setMessage("已设为分类示例");
      onFeaturedUpdated?.();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "设置失败");
    } finally {
      setBusy(false);
    }
  };

  const clearFeatured = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/book-mall/api/platform/v1/quick-replica/admin/kinds/${encodeURIComponent(template.kind)}/featured`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "清除失败");
      }
      setMessage("已清除分类示例");
      onFeaturedUpdated?.();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "清除失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <QrModal open={open} onClose={onClose} variant="preview" hideHeader>
      <div className="grid min-h-0 flex-1 grid-cols-3">
        {/* 左 2/3 · 参考作品（按比例） */}
        <div
          className="col-span-2 flex min-h-0 flex-col"
          style={{ background: "var(--qr-bg-page)" }}
        >
          <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
            {isVideo && previewUrl ? (
              <video
                src={previewUrl}
                controls
                className="max-h-full max-w-full object-contain"
                style={{ aspectRatio: aspectLabel.replace(":", " / ") }}
              />
            ) : previewUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={previewUrl}
                alt={template.title}
                className="max-h-full max-w-full object-contain"
                style={{ aspectRatio: aspectLabel.replace(":", " / ") }}
              />
            ) : (
              <p className="text-xs text-[var(--qr-text-muted)]">暂无预览</p>
            )}
          </div>
        </div>

        {/* 右 1/3 · 模板细节 / 提示词 */}
        <div
          className="col-span-1 flex min-h-0 flex-col"
          style={{ borderLeft: "1px solid var(--qr-border)" }}
        >
          <div
            className="flex shrink-0 items-start justify-between px-5 py-4"
            style={{ borderBottom: "1px solid var(--qr-border)" }}
          >
            <div>
              <h2 className="text-base font-semibold">模板</h2>
              <p className="mt-0.5 text-xs text-[var(--qr-text-muted)]">细节</p>
            </div>
            <button type="button" onClick={onClose} aria-label="关闭">
              <X className="h-4 w-4 text-[var(--qr-text-muted)]" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
            <div>
              <p className="text-sm font-medium">{template.title}</p>
              <p className="mt-1 text-xs text-[var(--qr-text-muted)]">
                {kindDef?.label ?? template.kind} · {template.reference.model.modelKey}
              </p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[var(--qr-text-secondary)]">
                  提示词
                </span>
                <button
                  type="button"
                  className="qr-btn-secondary px-2 py-1 text-xs"
                  onClick={() => void copyPrompt()}
                  aria-label="复制提示词"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-sm leading-relaxed text-[var(--qr-text-secondary)]">
                {promptPreview}
              </p>
              {promptText.length > 280 ? (
                <button
                  type="button"
                  className="mt-2 text-xs text-[var(--qr-brand)] hover:underline"
                  onClick={() => setPromptExpanded((v) => !v)}
                >
                  {promptExpanded ? "收起" : "查看更多"}
                </button>
              ) : null}
            </div>

            <div>
              <div className="mb-2 text-xs font-medium text-[var(--qr-text-secondary)]">
                设置
              </div>
              <span className="qr-aspect-pill">{aspectLabel}</span>
            </div>

            {message ? <p className="text-xs text-[var(--qr-text-muted)]">{message}</p> : null}

            {canManageFeatured ? (
              <div className="border-t pt-3" style={{ borderColor: "var(--qr-border)" }}>
                <div className="mb-2 text-xs text-[var(--qr-text-muted)]">管理员</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    className="qr-btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
                    onClick={() => void setFeatured(template.source === "user")}
                  >
                    设为分类示例
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="qr-btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
                    onClick={() => void clearFeatured()}
                  >
                    清除推荐
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="shrink-0 p-5" style={{ borderTop: "1px solid var(--qr-border)" }}>
            <button
              type="button"
              className="qr-btn-primary w-full"
              onClick={() => {
                onCopy(template);
                onClose();
              }}
            >
              复制
            </button>
          </div>
        </div>
      </div>
    </QrModal>
  );
}
