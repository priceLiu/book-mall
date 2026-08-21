"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clapperboard, Loader2, Search } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  CanvasListCover,
  CANVAS_LIST_GRID_CLASS,
} from "@/components/canvas/canvas-list-cover";
import { TemplatePreviewDialog } from "@/components/home/template-preview-dialog";
import { fetchCanvasViewerUser } from "@/lib/canvas-viewer-session";
import {
  duplicatePortalCaseProject,
  listPortalCaseProjects,
  type PortalCaseProjectSummary,
} from "@/lib/canvas-api";

function ownerLabel(
  owner?: { name: string | null; email: string | null } | null,
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
  const [cases, setCases] = useState<PortalCaseProjectSummary[]>([]);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<PortalCaseProjectSummary | null>(null);
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

    void listPortalCaseProjects(base, "sbv1")
      .then(setCases)
      .catch((e) => {
        setCases([]);
        setError(e instanceof Error ? e.message : "影视案例加载失败，请稍后重试");
      })
      .finally(() => setLoading(false));
  }, [base]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter((item) => {
      const haystack = [
        item.name,
        item.description,
        item.portalCaseBlurb,
        ownerLabel(item.owner),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [cases, search]);

  const onCopy = useCallback(
    async (item: PortalCaseProjectSummary) => {
      if (!base?.trim()) {
        setError("未配置主站地址");
        return;
      }
      setCopyingId(item.id);
      setError(null);
      try {
        const created = await duplicatePortalCaseProject(base, item.id);
        window.location.href = `/canvas/${created.id}`;
      } catch (e) {
        setError(e instanceof Error ? e.message : "复制失败");
        setCopyingId(null);
      }
    },
    [base],
  );

  const openItem = useCallback(
    (item: PortalCaseProjectSummary) => {
      if (viewerUserId && item.owner?.id === viewerUserId) {
        window.location.href = `/canvas/${item.id}`;
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
            分镜视频 1.0 成片与分镜图示例，封面与项目内媒体同源；预览后可复制到你的画布继续编辑。
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
          {cases.length === 0
            ? "暂无影视案例。管理员可将分镜视频 1.0 项目设为首页案例后展示在这里。"
            : "没有匹配的影视案例，请换个关键词试试。"}
        </p>
      ) : (
        <ul className={`mt-8 ${CANVAS_LIST_GRID_CLASS}`}>
          {filtered.map((item) => {
            const own = viewerUserId != null && item.owner?.id === viewerUserId;
            const busy = copyingId === item.id;

            const cardInner = (
              <>
                <CanvasListCover url={item.thumbnailUrl} name={item.name} />
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
                  {item.name}
                </h3>
                {item.portalCaseBlurb ? (
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--canvas-muted)]">
                    {item.portalCaseBlurb}
                  </p>
                ) : null}
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
                  <Link href={`/canvas/${item.id}`} className="block w-full text-left">
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
          name={preview.name}
          description={preview.portalCaseBlurb || preview.description}
          thumbnailUrl={preview.thumbnailUrl}
          onClose={() => setPreview(null)}
          onCopy={() => void onCopy(preview)}
          copying={copyingId === preview.id}
        />
      ) : null}
    </section>
  );
}
