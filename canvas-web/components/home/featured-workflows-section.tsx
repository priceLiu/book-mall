"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Eye, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { CanvasListCover } from "@/components/canvas/canvas-list-cover";
import { PortalCardIconButton } from "@/components/home/portal-card-icon-button";
import { TemplatePreviewDialog } from "@/components/home/template-preview-dialog";
import {
  duplicatePortalFeaturedProject,
  listPortalFeaturedProjects,
  type PortalFeaturedProjectSummary,
} from "@/lib/canvas-api";

export function FeaturedWorkflowsSection() {
  const base = useBookMallBaseUrl();
  const [projects, setProjects] = useState<PortalFeaturedProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PortalFeaturedProjectSummary | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!base?.trim()) return;
    setLoading(true);
    void listPortalFeaturedProjects(base)
      .then(setProjects)
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, [base]);

  const onCopy = useCallback(
    async (item: PortalFeaturedProjectSummary) => {
      if (!base?.trim()) {
        setError("未配置主站地址");
        return;
      }
      setCopyingId(item.id);
      setError(null);
      try {
        const created = await duplicatePortalFeaturedProject(base, item.id);
        window.location.href = `/canvas/${created.id}`;
      } catch (e) {
        setError(e instanceof Error ? e.message : "复制失败");
        setCopyingId(null);
      }
    },
    [base],
  );

  return (
    <section className="canvas-page pb-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="twenty-eyebrow flex items-center gap-2">
            <Sparkles className="size-4 text-[var(--canvas-accent)]" />
            Featured
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            精选工作流
          </h2>
          <p className="mt-1 text-sm text-[var(--canvas-muted)]">
            平台示例画布，封面与「我的画布」同源；一键复制到你的账户继续编辑。
          </p>
        </div>
        {loading ? (
          <Loader2 className="size-4 animate-spin text-white/40" />
        ) : null}
      </div>

      {error ? (
        <p className="mb-4 text-sm text-red-300/90">{error}</p>
      ) : null}

      {!loading && projects.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-white/40">
          暂无精选示例。管理员可在「我的画布」将已出图的项目设为首页示例。
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {projects.map((item) => (
            <li
              key={item.id}
              className="group rounded-2xl border border-[var(--canvas-border)] bg-[var(--canvas-surface)] p-4 transition hover:border-[var(--canvas-accent)]/40"
            >
              <button
                type="button"
                className="block w-full text-left"
                onClick={() => setPreview(item)}
              >
                <CanvasListCover url={item.thumbnailUrl} name={item.name} />
                <h3 className="mt-3 text-sm font-medium text-white">{item.name}</h3>
                {item.portalFeaturedBlurb ? (
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--canvas-muted)]">
                    {item.portalFeaturedBlurb}
                  </p>
                ) : null}
                <p className="mt-3 text-[11px] text-[var(--canvas-muted)]/80">
                  平台示例
                </p>
              </button>
              <div className="mt-3 flex items-center justify-end gap-2">
                <PortalCardIconButton
                  title="预览"
                  aria-label="预览"
                  onClick={() => setPreview(item)}
                >
                  <Eye className="size-3.5" />
                </PortalCardIconButton>
                <PortalCardIconButton
                  title="复制到我的画布"
                  aria-label="复制到我的画布"
                  disabled={copyingId === item.id}
                  onClick={() => void onCopy(item)}
                >
                  {copyingId === item.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </PortalCardIconButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {preview ? (
        <TemplatePreviewDialog
          name={preview.name}
          description={preview.portalFeaturedBlurb || preview.description}
          thumbnailUrl={preview.thumbnailUrl}
          onClose={() => setPreview(null)}
          onCopy={() => void onCopy(preview)}
          copying={copyingId === preview.id}
        />
      ) : null}

      <p className="mt-6 text-center text-xs text-[var(--canvas-muted)]">
        更多画布见
        <Link href="/projects" className="ml-1 text-[var(--canvas-accent)] hover:underline">
          我的画布
        </Link>
      </p>
    </section>
  );
}
