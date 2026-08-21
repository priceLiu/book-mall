"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clapperboard, Film, ImageIcon, Loader2, Search } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { ProjectCoverMedia } from "@/components/canvas/project-cover-media";
import { CANVAS_LIST_GRID_CLASS } from "@/components/canvas/canvas-list-cover";
import { TemplatePreviewDialog } from "@/components/home/template-preview-dialog";
import { fetchCanvasViewerUser } from "@/lib/canvas-viewer-session";
import {
  duplicatePortalFilmShowcaseProject,
  forkCanvasTemplate,
  listPortalFilmShowcase,
  createCanvasProject,
  type PortalFilmShowcaseMedia,
} from "@/lib/canvas-api";
import { cloneGraphForNewProject } from "@/lib/canvas/clone";
import { migrateGraphV1ToV2 } from "@/lib/canvas/migrate";
import type { CanvasGraph } from "@/lib/canvas/types";

function ownerLabel(
  owner?: { id: string; name: string | null; email: string | null } | null,
): string {
  if (!owner) return "社区用户";
  const name = owner.name?.trim();
  if (name) return name;
  const email = owner.email?.trim();
  if (email) return email.split("@")[0] ?? email;
  return "用户";
}

export function PortalFilmCasesSection() {
  const base = useBookMallBaseUrl();
  const [items, setItems] = useState<PortalFilmShowcaseMedia[]>([]);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<PortalFilmShowcaseMedia | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!base?.trim()) return;
    void fetchCanvasViewerUser(base)
      .then((u) => setViewerUserId(u?.id ?? null))
      .catch(() => setViewerUserId(null));
  }, [base]);

  useEffect(() => {
    if (!base?.trim()) return;
    setLoading(true);
    setError(null);

    void listPortalFilmShowcase(base, 48)
      .then(setItems)
      .catch((e) => {
        setItems([]);
        setError(e instanceof Error ? e.message : "影视案例加载失败，请稍后重试");
      })
      .finally(() => setLoading(false));
  }, [base]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const haystack = [item.projectName, item.description, ownerLabel(item.owner)]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, search]);

  const onCopy = useCallback(
    async (item: PortalFilmShowcaseMedia) => {
      if (!base?.trim()) {
        setError("未配置主站地址");
        return;
      }
      setCopyingId(item.sourceId);
      setError(null);
      try {
        if (item.sourceKind === "template") {
          const forked = await forkCanvasTemplate(base, item.sourceId);
          const graph = migrateGraphV1ToV2(forked.canvas as CanvasGraph);
          const created = await createCanvasProject(base, {
            name: `${item.projectName} 画布`,
            canvas: cloneGraphForNewProject(graph),
          });
          window.location.href = `/canvas/${created.id}`;
          return;
        }
        const created = await duplicatePortalFilmShowcaseProject(base, item.sourceId);
        window.location.href = `/canvas/${created.id}`;
      } catch (e) {
        setError(e instanceof Error ? e.message : "复制失败");
        setCopyingId(null);
      }
    },
    [base],
  );

  const openItem = useCallback(
    (item: PortalFilmShowcaseMedia) => {
      if (
        item.sourceKind === "project" &&
        viewerUserId &&
        item.owner?.id === viewerUserId
      ) {
        window.location.href = `/canvas/${item.sourceId}`;
        return;
      }
      setPreview(item);
    },
    [viewerUserId],
  );

  return (
    <section className="canvas-page border-t border-[var(--canvas-border)] pb-16 pt-8">
      <div className="mb-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="twenty-eyebrow flex items-center gap-2">
            <Clapperboard className="size-4 text-cyan-400/90" />
            Storyboard Video 1.0
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">影视案例</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--canvas-muted)]">
            分镜视频 1.0 已入库的分镜图与成片，按项目内 OSS 媒体展示；预览后可复制到你的画布继续编辑。
          </p>
        </div>
        <div className="relative w-full max-w-xs shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--canvas-muted)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索影视案例"
            className="w-full rounded-full border border-[var(--canvas-border)] bg-[var(--canvas-surface)] py-2 pl-9 pr-4 text-sm text-white placeholder:text-[var(--canvas-muted)] focus:border-cyan-400/40 focus:outline-none"
          />
        </div>
      </div>

      {error ? <p className="mb-4 mt-4 text-sm text-red-300/90">{error}</p> : null}

      {loading ? (
        <div className="mt-8 flex items-center gap-2 py-12 text-sm text-[var(--canvas-muted)]">
          <Loader2 className="size-4 animate-spin" />
          加载影视案例…
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-white/40">
          {items.length === 0
            ? "暂无影视案例。在分镜视频 1.0 画布中生成并入库的图片/视频会自动展示在这里。"
            : "没有匹配的影视案例，请换个关键词试试。"}
        </p>
      ) : (
        <ul className={`mt-8 ${CANVAS_LIST_GRID_CLASS}`}>
          {filtered.map((item) => {
            const own =
              item.sourceKind === "project" &&
              viewerUserId != null &&
              item.owner?.id === viewerUserId;
            const busy = copyingId === item.sourceId;

            const cardInner = (
              <>
                <div className="relative aspect-[340/190] w-full overflow-hidden rounded-xl bg-[var(--canvas-surface-2)]">
                  <div className="absolute inset-0 size-full">
                    <ProjectCoverMedia
                      url={item.url}
                      alt={item.projectName}
                      placeholderLetter={item.projectName}
                    />
                  </div>
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] text-white/90 backdrop-blur-sm">
                    {item.kind === "video" ? (
                      <Film className="size-3" aria-hidden />
                    ) : (
                      <ImageIcon className="size-3" aria-hidden />
                    )}
                    {item.kind === "video" ? "视频" : "分镜图"}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-medium text-white/80"
                    aria-hidden
                  >
                    {ownerLabel(item.owner).slice(0, 1).toUpperCase()}
                  </span>
                  <span className="truncate text-xs text-[var(--canvas-muted)]">
                    {ownerLabel(item.owner)}
                  </span>
                  <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-300/90">
                    分镜 1.0
                  </span>
                </div>
                <h3 className="mt-2 line-clamp-2 text-sm font-medium text-white">
                  {item.projectName}
                </h3>
                {busy ? (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-cyan-300/90">
                    <Loader2 className="size-3 animate-spin" />
                    正在打开…
                  </p>
                ) : null}
              </>
            );

            return (
              <li
                key={item.id}
                className="group rounded-2xl border border-[var(--canvas-border)] bg-[var(--canvas-surface)] p-3 transition hover:border-cyan-400/35"
              >
                {own ? (
                  <Link href={`/canvas/${item.sourceId}`} className="block w-full text-left">
                    {cardInner}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="block w-full text-left"
                    onClick={() => openItem(item)}
                    disabled={busy}
                  >
                    {cardInner}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {preview ? (
        <TemplatePreviewDialog
          name={preview.projectName}
          description={preview.description}
          thumbnailUrl={preview.url}
          onClose={() => setPreview(null)}
          onCopy={() => void onCopy(preview)}
          copying={copyingId === preview.sourceId}
        />
      ) : null}
    </section>
  );
}
