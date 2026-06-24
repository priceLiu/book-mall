"use client";

import { useCallback, useEffect, useState } from "react";
import { Bookmark, Eye, X } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  listCanvasTemplates,
  type CanvasTemplateRecord,
} from "@/lib/canvas-api";
import { CanvasPanelShellLoading } from "@/components/canvas/canvas-panel-shell-loading";
import { CanvasToolbarSidePanelShell } from "@/components/canvas/canvas-toolbar-side-panel-shell";
import {
  invalidateToolbarPanelCache,
  peekToolbarPanelCache,
  toolbarPanelCacheKey,
  writeToolbarPanelCache,
} from "@/lib/canvas/toolbar-panel-cache";
import {
  CANVAS_PANEL_ITEM_CARD_CLASS,
  CANVAS_PANEL_SHELL_BODY_CLASS,
  CANVAS_PANEL_SHELL_ERROR_CLASS,
  CANVAS_PANEL_SHELL_HEADER_CLASS,
  CANVAS_PANEL_SHELL_THUMB_SM_CLASS,
} from "@/lib/canvas/canvas-chrome-semantics";
import type { CanvasGraph } from "@/lib/canvas/types";
import { cn } from "@/lib/utils";
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

  const load = useCallback(async (opts?: { force?: boolean }) => {
    if (!base) return;
    const cacheKey = toolbarPanelCacheKey("canvas-templates");
    const cached = peekToolbarPanelCache<CanvasTemplateRecord[]>(cacheKey, opts);
    if (cached) {
      setTemplates(cached);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      const all = await listCanvasTemplates(base);
      const userTemplates = all.filter((t) => !t.builtin);
      setTemplates(userTemplates);
      writeToolbarPanelCache(cacheKey, userTemplates);
      setError(null);
    } catch (e) {
      setTemplates([]);
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    if (!open) return;
    void load({ force: refreshKey > 0 });
  }, [open, load, refreshKey]);

  if (!open && !viewing) return null;

  return (
    <>
      {open ? (
        <CanvasToolbarSidePanelShell
          open={open}
          onClose={onClose}
          ariaLabel="我的模板"
        >
            <header className={CANVAS_PANEL_SHELL_HEADER_CLASS}>
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

            <div className={CANVAS_PANEL_SHELL_BODY_CLASS}>
              {error ? (
                <p className={CANVAS_PANEL_SHELL_ERROR_CLASS}>{error}</p>
              ) : null}

              {loading ? (
                <CanvasPanelShellLoading />
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
                        className={cn(
                          "flex w-full items-center gap-3 text-left transition hover:bg-black/35",
                          CANVAS_PANEL_ITEM_CARD_CLASS,
                        )}
                      >
                        <div className={cn(CANVAS_PANEL_SHELL_THUMB_SM_CLASS, "size-14 overflow-hidden")}>
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
        </CanvasToolbarSidePanelShell>
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
