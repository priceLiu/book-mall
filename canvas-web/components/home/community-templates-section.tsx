"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Eye, Loader2, Trash2, Users } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { CanvasListCover } from "@/components/canvas/canvas-list-cover";
import { PortalCardIconButton } from "@/components/home/portal-card-icon-button";
import { TemplatePreviewDialog } from "@/components/home/template-preview-dialog";
import { useCanvasAdmin } from "@/components/home/use-canvas-admin";
import {
  createCanvasProject,
  deleteCanvasTemplate,
  forkCanvasTemplate,
  listCanvasTemplates,
  type CanvasTemplateRecord,
} from "@/lib/canvas-api";
import { cloneGraphForNewProject } from "@/lib/canvas/clone";
import { migrateGraphV1ToV2 } from "@/lib/canvas/migrate";
import type { CanvasGraph } from "@/lib/canvas/types";

export function CommunityTemplatesSection() {
  const base = useBookMallBaseUrl();
  const isAdmin = useCanvasAdmin();
  const { doubleConfirm, alert } = useDialogs();
  const [templates, setTemplates] = useState<CanvasTemplateRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<CanvasTemplateRecord | null>(null);
  const [forkingId, setForkingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!base?.trim()) return;
    setLoading(true);
    void listCanvasTemplates(base, "public")
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, [base]);

  const onForkToCanvas = useCallback(
    async (tpl: CanvasTemplateRecord) => {
      if (!base?.trim()) {
        setError("未配置主站地址");
        return;
      }
      setForkingId(tpl.id);
      setError(null);
      try {
        const forked = await forkCanvasTemplate(base, tpl.id);
        const graph = migrateGraphV1ToV2(forked.canvas as CanvasGraph);
        const created = await createCanvasProject(base, {
          name: `${tpl.name} 画布`,
          canvas: cloneGraphForNewProject(graph),
        });
        window.location.href = `/canvas/${created.id}`;
      } catch (e) {
        setError(e instanceof Error ? e.message : "复制失败");
        setForkingId(null);
      }
    },
    [base],
  );

  const onDeleteTemplate = useCallback(
    async (tpl: CanvasTemplateRecord) => {
      if (!base?.trim()) return;
      const ok = await doubleConfirm({
        first: {
          title: `删除模板「${tpl.name}」？`,
          message: "将从首页社区列表移除该模板。",
          confirmLabel: "继续",
          danger: true,
        },
        second: {
          title: "再次确认 · 不可恢复",
          message:
            "将永久删除模板记录；他人已复制到画布的副本不受影响。",
          confirmLabel: "永久删除",
          danger: true,
        },
      });
      if (!ok) return;
      setDeletingId(tpl.id);
      try {
        await deleteCanvasTemplate(base, tpl.id);
        setTemplates((prev) => prev.filter((t) => t.id !== tpl.id));
        if (preview?.id === tpl.id) setPreview(null);
      } catch (e) {
        await alert({
          title: "删除失败",
          message: e instanceof Error ? e.message : "请稍后重试",
          variant: "error",
        });
      } finally {
        setDeletingId(null);
      }
    },
    [alert, base, doubleConfirm, preview?.id],
  );

  return (
    <section className="canvas-page border-t border-[var(--canvas-border)] pb-16 pt-10">
      <div className="mb-6">
        <p className="twenty-eyebrow flex items-center gap-2">
          <Users className="size-4 text-[var(--canvas-accent)]" />
          Templates
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">社区模板</h2>
        <p className="mt-1 text-sm text-[var(--canvas-muted)]">
          用户公开分享的工作流，可复制到你的画布继续编辑。
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-white/45">
          <Loader2 className="size-4 animate-spin" />
          加载社区模板…
        </div>
      ) : null}

      {error ? (
        <p className="mb-4 text-sm text-red-300/90">{error}</p>
      ) : null}

      {!loading && templates.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/40">
          暂无公开模板。在画布工具栏或组顶栏点击「分享工作流」即可发布到社区。
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {templates.map((tpl) => (
            <li
              key={tpl.id}
              className="group rounded-2xl border border-[var(--canvas-border)] bg-[var(--canvas-surface)] p-4 transition hover:border-[var(--canvas-accent)]/40"
            >
              <button
                type="button"
                className="block w-full text-left"
                onClick={() => setPreview(tpl)}
              >
                <CanvasListCover
                  url={tpl.thumbnailUrl || tpl.thumbnail}
                  name={tpl.name}
                />
                <h3 className="mt-3 text-sm font-medium text-white">{tpl.name}</h3>
                {tpl.description?.trim() ? (
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--canvas-muted)]">
                    {tpl.description.trim()}
                  </p>
                ) : null}
                <p className="mt-3 text-[11px] text-[var(--canvas-muted)]/80">
                  {tpl.owner?.name || tpl.owner?.email || "社区用户"}
                  {typeof tpl.forkCount === "number" && tpl.forkCount > 0
                    ? ` · ${tpl.forkCount} 次复制`
                    : ""}
                </p>
              </button>
              <div className="mt-3 flex items-center justify-end gap-2">
                <PortalCardIconButton
                  title="预览"
                  aria-label="预览"
                  onClick={() => setPreview(tpl)}
                >
                  <Eye className="size-3.5" />
                </PortalCardIconButton>
                <PortalCardIconButton
                  title="复制到我的画布"
                  aria-label="复制到我的画布"
                  disabled={forkingId === tpl.id}
                  onClick={() => void onForkToCanvas(tpl)}
                >
                  {forkingId === tpl.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </PortalCardIconButton>
                {isAdmin ? (
                  <PortalCardIconButton
                    variant="danger"
                    title="删除模板"
                    aria-label="删除模板"
                    disabled={deletingId === tpl.id}
                    onClick={() => void onDeleteTemplate(tpl)}
                  >
                    {deletingId === tpl.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </PortalCardIconButton>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {preview ? (
        <TemplatePreviewDialog
          name={preview.name}
          description={preview.description || preview.sourceLabel || undefined}
          thumbnailUrl={preview.thumbnailUrl || preview.thumbnail}
          onClose={() => setPreview(null)}
          onCopy={() => void onForkToCanvas(preview)}
          copying={forkingId === preview.id}
        />
      ) : null}
    </section>
  );
}
