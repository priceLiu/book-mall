"use client";

import { useCallback, useEffect, useState } from "react";
import { Bookmark, Eye, Loader2, X } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  listCanvasTemplates,
  type CanvasTemplateRecord,
} from "@/lib/canvas-api";
import type { CanvasGraph } from "@/lib/canvas/types";
import { TemplateReadonlyCanvas } from "./template-readonly-canvas";

export function MyTemplatesPanel({
  open,
  onClose,
  refreshKey = 0,
}: {
  open: boolean;
  onClose: () => void;
  /** 父组件在「存为模板」成功后递增，触发重新拉取 */
  refreshKey?: number;
}) {
  const base = useBookMallBaseUrl();
  const [templates, setTemplates] = useState<CanvasTemplateRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<CanvasTemplateRecord | null>(null);

  const load = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    try {
      const all = await listCanvasTemplates(base);
      setTemplates(all.filter((t) => !t.builtin));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load, refreshKey]);

  if (!open && !viewing) return null;

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-[60] flex justify-end bg-black/45"
          onClick={onClose}
          role="presentation"
        >
          <aside
            className="flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-[var(--canvas-surface)] text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="我的模板"
          >
            <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <Bookmark className="size-4 text-[var(--canvas-accent)]" />
                <p className="text-sm font-medium">我的模板</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1 text-[var(--canvas-muted)] hover:bg-white/5 hover:text-white"
                aria-label="关闭"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {error ? (
                <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
                  {error}
                </p>
              ) : null}

              {loading ? (
                <div className="flex items-center gap-2 py-8 text-sm text-[var(--canvas-muted)]">
                  <Loader2 className="size-4 animate-spin" />
                  加载中…
                </div>
              ) : templates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-[12px] text-[var(--canvas-muted)]">
                  还没有保存的模板。
                  <br />
                  在工具栏点「存为模板」即可保存当前画布。
                </div>
              ) : (
                <ul className="space-y-2">
                  {templates.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setViewing(t)}
                        className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-[var(--canvas-accent)]/40 hover:bg-[var(--canvas-accent)]/5"
                      >
                        <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-[var(--canvas-accent)]/20 to-black/40">
                          {t.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={t.thumbnail}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-lg font-light text-white/30">
                              {t.name.slice(0, 1) || "模"}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-white">
                            {t.name}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[var(--canvas-muted)]">
                            {new Date(t.updatedAt).toLocaleString("zh-CN")}
                          </p>
                        </div>
                        <Eye className="size-4 shrink-0 text-[var(--canvas-muted)]" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <footer className="border-t border-white/10 px-4 py-2 text-[10px] text-[var(--canvas-muted)]">
              点击模板可只读预览，不会修改当前画布。
            </footer>
          </aside>
        </div>
      ) : null}

      {viewing ? (
        <TemplateViewerOverlay
          template={viewing}
          onClose={() => setViewing(null)}
        />
      ) : null}
    </>
  );
}

function TemplateViewerOverlay({
  template,
  onClose,
}: {
  template: CanvasTemplateRecord;
  onClose: () => void;
}) {
  const graph = template.canvas as CanvasGraph;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-[var(--canvas-bg)]"
      role="dialog"
      aria-label={`模板预览：${template.name}`}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[var(--canvas-surface)] px-4 py-2.5 text-white">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{template.name}</p>
          <p className="text-[11px] text-[var(--canvas-muted)]">
            只读预览 · 不可编辑
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-[var(--canvas-muted)] hover:border-white/30 hover:text-white"
        >
          <X className="size-3.5" />
          关闭
        </button>
      </header>
      <div className="relative min-h-0 flex-1">
        <TemplateReadonlyCanvas graph={graph} />
      </div>
    </div>
  );
}
