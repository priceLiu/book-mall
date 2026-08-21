"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clapperboard, Loader2, Search } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { FilmShowcaseCardMedia } from "@/components/home/film-showcase-card-media";
import { ShowcaseMediaKindBadge } from "@/components/home/showcase-media-kind-badge";
import { CANVAS_LIST_GRID_CLASS } from "@/components/canvas/canvas-list-cover";
import { TemplatePreviewDialog } from "@/components/home/template-preview-dialog";
import { fetchCanvasViewerUser } from "@/lib/canvas-viewer-session";
import {
  duplicatePortalFilmShowcaseProject,
  listPortalFilmShowcase,
  type PortalFilmShowcaseMedia,
} from "@/lib/canvas-api";
import { isPortalGuestAuthLoadError } from "@/lib/canvas/portal-load-errors";

function ownerLabel(
  owner?: { id: string; name: string | null; email: string | null } | null,
): string {
  if (!owner) return "团队客户";
  const name = owner.name?.trim();
  if (name) return name;
  const email = owner.email?.trim();
  if (email) return email.split("@")[0] ?? email;
  return "团队客户";
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
  const [loadFailed, setLoadFailed] = useState(false);

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
    setLoadFailed(false);

    void listPortalFilmShowcase(base)
      .then(setItems)
      .catch((e) => {
        setItems([]);
        setLoadFailed(true);
        const msg = e instanceof Error ? e.message : "视频作品加载失败，请稍后重试";
        if (!isPortalGuestAuthLoadError(msg)) {
          setError(msg);
        }
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
      if (viewerUserId && item.owner?.id === viewerUserId) {
        window.location.href = `/canvas/${item.sourceId}`;
        return;
      }
      setPreview(item);
    },
    [viewerUserId],
  );

  if (!loading && items.length === 0 && !error && !loadFailed) return null;

  return (
    <section className="canvas-page border-t border-[var(--canvas-border)] pb-16 pt-8">
      <div className="mb-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="twenty-eyebrow flex items-center gap-2">
            <Clapperboard className="size-4 text-cyan-400/90" />
            Storyboard Video 1.0
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">视频作品</h2>
        </div>
        <div className="relative w-full max-w-xs shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--canvas-muted)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索视频作品"
            className="w-full rounded-full border border-[var(--canvas-border)] bg-[var(--canvas-surface)] py-2 pl-9 pr-4 text-sm text-white placeholder:text-[var(--canvas-muted)] focus:border-cyan-400/40 focus:outline-none"
          />
        </div>
      </div>

      {error ? <p className="mb-4 mt-4 text-sm text-red-300/90">{error}</p> : null}

      {loading ? (
        <div className="mt-8 flex items-center gap-2 py-12 text-sm text-[var(--canvas-muted)]">
          <Loader2 className="size-4 animate-spin" />
          加载视频作品…
        </div>
      ) : loadFailed ? (
        <p className="mt-8 rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-white/40">
          暂时无法加载视频作品，请稍后刷新页面。
        </p>
      ) : filtered.length > 0 ? (
        <ul className={`mt-8 ${CANVAS_LIST_GRID_CLASS}`}>
          {filtered.map((item) => {
            const own =
              viewerUserId != null && item.owner?.id === viewerUserId;
            const busy = copyingId === item.sourceId;

            const cardInner = (
              <>
                <div className="relative aspect-[340/190] w-full overflow-hidden rounded-xl bg-[var(--canvas-surface-2)]">
                  <div className="absolute inset-0 size-full">
                    <FilmShowcaseCardMedia
                      url={item.url}
                      alt={item.projectName}
                      kind={item.kind}
                      posterUrl={item.posterUrl}
                      placeholderLetter={item.projectName}
                    />
                  </div>
                  <ShowcaseMediaKindBadge kind={item.kind} />
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
      ) : null}

      {preview ? (
        <TemplatePreviewDialog
          name={preview.projectName}
          description={preview.description}
          thumbnailUrl={preview.url}
          mediaKind={preview.kind}
          posterUrl={preview.posterUrl}
          onClose={() => setPreview(null)}
          onCopy={() => void onCopy(preview)}
          copying={copyingId === preview.sourceId}
        />
      ) : null}
    </section>
  );
}
