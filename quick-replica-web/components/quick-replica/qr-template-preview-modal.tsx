"use client";

import { useCallback, useState } from "react";
import { Copy, Trash2, X } from "lucide-react";

import { QrModal } from "@/components/quick-replica/qr-modal";
import { QrRefImageThumb } from "@/components/quick-replica/qr-ref-image-thumb";
import { QrToast } from "@/components/quick-replica/qr-toast";
import { getKindDef, type QrTemplate } from "@/lib/qr-template-types";
import { resolveTemplateSceneImageUrls } from "@/lib/qr-template-preview-media";

type Props = {
  template: QrTemplate | null;
  open: boolean;
  canManageFeatured: boolean;
  onClose: () => void;
  onCopy: (template: QrTemplate) => void;
  allowDelete?: boolean;
  onDelete?: (template: QrTemplate) => void;
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
  allowDelete = false,
  onDelete,
  onFeaturedUpdated,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const dismissCopyToast = useCallback(() => setCopyToast(null), []);

  if (!template) return null;

  const kindDef = getKindDef(template.kind);
  const aspectLabel = resolveAspectRatioLabel(template);
  const { url: previewUrl, isVideo } = resolvePreviewMedia(template);
  const promptText = template.reference.prompt.text;
  const sceneImageUrls = resolveTemplateSceneImageUrls(template);
  const promptPreview =
    promptExpanded || promptText.length <= 280
      ? promptText
      : `${promptText.slice(0, 280)}…`;

  const copyPrompt = async () => {
    const showResult = (text: string) => setCopyToast(text);

    const fallbackCopy = (): boolean => {
      try {
        const ta = document.createElement("textarea");
        ta.value = promptText;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch {
        return false;
      }
    };

    try {
      await navigator.clipboard.writeText(promptText);
      showResult("复制成功");
      return;
    } catch {
      /* clipboard API blocked */
    }

    if (fallbackCopy()) {
      showResult("复制成功");
    } else {
      showResult("复制失败，请手动复制");
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
    <>
      <QrModal open={open} onClose={onClose} variant="preview" hideHeader>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        {/* 左 ~2/3 · 参考作品（大图 contain） */}
        <div
          className="flex h-[46%] min-h-0 w-full shrink-0 items-center justify-center overflow-hidden p-3 md:h-auto md:flex-1 md:p-8"
          style={{ background: "var(--qr-bg-page)" }}
        >
          {previewUrl ? (
            isVideo ? (
              <video
                src={previewUrl}
                controls
                className="h-full w-full max-h-full rounded-xl object-contain"
                playsInline
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={previewUrl}
                alt={template.title}
                className="h-full w-full max-h-full rounded-xl object-contain"
              />
            )
          ) : (
            <div className="flex h-full min-h-[12rem] items-center justify-center">
              <p className="text-xs text-[var(--qr-text-muted)]">暂无预览</p>
            </div>
          )}
        </div>

        {/* 右 ~1/3 · 模板细节 / 提示词 */}
        <div
          className="flex min-h-0 min-w-0 flex-1 flex-col border-t border-[var(--qr-border)] md:w-[420px] md:flex-none md:border-l md:border-t-0"
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

            {sceneImageUrls.length > 0 ? (
              <div>
                <div className="mb-2 text-xs font-medium text-[var(--qr-text-secondary)]">
                  引用图片
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {sceneImageUrls.map((url, index) => (
                    <QrRefImageThumb
                      key={`${url}-${index}`}
                      url={url}
                      index={index}
                      size="md"
                      readonly
                    />
                  ))}
                </div>
              </div>
            ) : null}

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

          <div className="shrink-0 space-y-2 p-5" style={{ borderTop: "1px solid var(--qr-border)" }}>
            {allowDelete && template.source === "user" && onDelete ? (
              deleteStep === 0 ? (
                <button
                  type="button"
                  className="qr-btn-secondary flex w-full items-center justify-center gap-2 text-red-300"
                  onClick={() => setDeleteStep(1)}
                >
                  <Trash2 className="h-4 w-4" />
                  删除
                </button>
              ) : deleteStep === 1 ? (
                <div className="space-y-2">
                  <p className="text-xs text-[var(--qr-text-secondary)]">
                    确定删除「{template.title}」？
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="qr-btn-secondary flex-1 text-xs"
                      onClick={() => setDeleteStep(0)}
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      className="qr-btn-primary flex-1 text-xs"
                      onClick={() => setDeleteStep(2)}
                    >
                      继续
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-red-200">
                    此操作不可恢复，将永久删除该作品记录。
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="qr-btn-secondary flex-1 text-xs"
                      onClick={() => setDeleteStep(0)}
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      className="qr-btn-primary flex-1 text-xs"
                      onClick={() => {
                        onDelete(template);
                        setDeleteStep(0);
                      }}
                    >
                      确认删除
                    </button>
                  </div>
                </div>
              )
            ) : null}
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

      <QrToast message={copyToast} onDismiss={dismissCopyToast} />
    </>
  );
}
