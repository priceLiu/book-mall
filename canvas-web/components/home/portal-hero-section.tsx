"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Loader2, Plus } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { CanvasListCover } from "@/components/canvas/canvas-list-cover";
import { createPro2BlankCanvasProject } from "@/lib/canvas/create-pro2-blank-project";
import {
  duplicatePortalFeaturedProject,
  listPortalFeaturedProjects,
  type PortalFeaturedProjectSummary,
} from "@/lib/canvas-api";
import { pickRandomItems } from "@/lib/pick-random";

const CHIP_COUNT = 3;

export function PortalHeroSection() {
  const base = useBookMallBaseUrl();
  const [allFeatured, setAllFeatured] = useState<PortalFeaturedProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chips = useMemo(
    () => pickRandomItems(allFeatured, CHIP_COUNT),
    [allFeatured],
  );

  useEffect(() => {
    if (!base?.trim()) return;
    setLoading(true);
    void listPortalFeaturedProjects(base)
      .then((list) =>
        setAllFeatured(
          Array.isArray(list) ? list.filter((p) => p.edition === "pro2") : [],
        ),
      )
      .catch(() => setAllFeatured([]))
      .finally(() => setLoading(false));
  }, [base]);

  const onStartCreate = useCallback(async () => {
    if (!base?.trim()) {
      setError("未配置主站地址");
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const { id } = await createPro2BlankCanvasProject(base);
      window.location.href = `/canvas/${id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
      setStarting(false);
    }
  }, [base]);

  const onQuickStart = useCallback(
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
    <section className="canvas-page pt-8 pb-4">
      <div
        className="rounded-2xl border border-[var(--canvas-border)] bg-[var(--canvas-surface)] px-6 py-8 sm:px-10 sm:py-10"
      >
        <div className="flex flex-col items-center text-center">
          <button
            type="button"
            disabled={starting}
            onClick={() => void onStartCreate()}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-8 py-3 text-base font-medium text-white transition hover:border-[var(--canvas-accent)]/50 hover:bg-white/10 disabled:opacity-60"
          >
            {starting ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Plus className="size-5" />
            )}
            开始我的创作
          </button>

          {loading ? (
            <p className="mt-6 flex items-center gap-2 text-sm text-[var(--canvas-muted)]">
              <Loader2 className="size-4 animate-spin" />
              加载精选工作流…
            </p>
          ) : chips.length > 0 ? (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {chips.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={copyingId === item.id}
                  onClick={() => void onQuickStart(item)}
                  className="inline-flex max-w-[220px] items-center gap-2 rounded-full border border-white/10 bg-black/30 py-1.5 pl-1.5 pr-4 text-left transition hover:border-[var(--canvas-accent)]/40 hover:bg-black/50 disabled:opacity-60"
                >
                  <span className="size-9 shrink-0 overflow-hidden rounded-full border border-white/10">
                    <CanvasListCover
                      url={item.thumbnailUrl}
                      name={item.name}
                      className="!aspect-square !rounded-full !border-0"
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-white">
                      {item.name}
                    </span>
                    <span className="block truncate text-[10px] text-[var(--canvas-muted)]">
                      {item.portalFeaturedBlurb || "精选工作流"}
                    </span>
                  </span>
                  {copyingId === item.id ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin text-[var(--canvas-accent)]" />
                  ) : (
                    <Copy className="size-3.5 shrink-0 text-[var(--canvas-muted)]" />
                  )}
                </button>
              ))}
            </div>
          ) : null}

          {error ? (
            <p className="mt-4 text-sm text-red-300/90">{error}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
