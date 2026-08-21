"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Loader2, Plus } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { CanvasListCover } from "@/components/canvas/canvas-list-cover";
import { createPro2BlankCanvasProject } from "@/lib/canvas/create-pro2-blank-project";
import {
  duplicatePortalFeaturedProject,
  listCanvasTemplates,
  listPortalCaseProjects,
  listPortalFeaturedProjects,
  type CanvasTemplateRecord,
  type PortalCaseProjectSummary,
  type PortalFeaturedProjectSummary,
} from "@/lib/canvas-api";
import { pickRandomItems } from "@/lib/pick-random";
import {
  collectProjectImageUrls,
  isProjectThumbnailVideoUrl,
} from "@/lib/canvas/project-thumbnail";
import type { CanvasGraph } from "@/lib/canvas/types";

const CHIP_COUNT = 3;
const BG_ROTATE_MS = 3000;

/** 左右大图槽：全高 cover，仅两侧露出 */
const HERO_BG_LAYERS = [
  {
    key: "left",
    className: "inset-y-0 left-0 w-[58%] [mask-image:linear-gradient(to_right,black_55%,transparent)]",
    opacity: 0.48,
  },
  {
    key: "right",
    className:
      "inset-y-0 right-0 w-[58%] [mask-image:linear-gradient(to_left,black_55%,transparent)]",
    opacity: 0.42,
  },
] as const;

function addImageUrl(pool: Set<string>, url?: string | null) {
  const trimmed = url?.trim();
  if (trimmed && !isProjectThumbnailVideoUrl(trimmed)) pool.add(trimmed);
}

function collectPortalHeroImagePool(args: {
  featured: PortalFeaturedProjectSummary[];
  templates: CanvasTemplateRecord[];
  cases: PortalCaseProjectSummary[];
}): string[] {
  const pool = new Set<string>();
  for (const p of args.featured) addImageUrl(pool, p.thumbnailUrl);
  for (const c of args.cases) addImageUrl(pool, c.thumbnailUrl);
  for (const t of args.templates) {
    addImageUrl(pool, t.thumbnailUrl ?? t.thumbnail);
    if (t.canvas) {
      for (const url of collectProjectImageUrls(t.canvas as CanvasGraph)) {
        pool.add(url);
      }
    }
  }
  return [...pool];
}

function poolUrlAt(pool: string[], index: number): string | undefined {
  if (pool.length === 0) return undefined;
  const safe = ((index % pool.length) + pool.length) % pool.length;
  return pool[safe];
}

function PortalHeroBackdrop({
  leftUrl,
  rightUrl,
}: {
  leftUrl?: string;
  rightUrl?: string;
}) {
  if (!leftUrl && !rightUrl) return null;

  const layers = [
    { layer: HERO_BG_LAYERS[0], url: leftUrl },
    { layer: HERO_BG_LAYERS[1], url: rightUrl ?? leftUrl },
  ];

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
      aria-hidden
    >
      {layers.map(({ layer, url }) => {
        if (!layer || !url) return null;
        return (
          <div
            key={layer.key}
            className={`absolute overflow-hidden ${layer.className}`}
            style={{ opacity: layer.opacity }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={url}
              src={url}
              alt=""
              className="size-full scale-105 object-cover opacity-0 animate-[portalHeroFadeIn_0.8s_ease-out_forwards]"
              loading="lazy"
              decoding="async"
            />
          </div>
        );
      })}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_60%_at_50%_50%,var(--canvas-surface)_0%,var(--canvas-surface)_38%,transparent_100%)]" />
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--canvas-surface)]/55 via-[var(--canvas-surface)]/20 to-[var(--canvas-surface)]/55" />
    </div>
  );
}

export function PortalHeroSection() {
  const base = useBookMallBaseUrl();
  const [allFeatured, setAllFeatured] = useState<PortalFeaturedProjectSummary[]>([]);
  const [publicTemplates, setPublicTemplates] = useState<CanvasTemplateRecord[]>([]);
  const [portalCases, setPortalCases] = useState<PortalCaseProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chips = useMemo(
    () => pickRandomItems(allFeatured, CHIP_COUNT),
    [allFeatured],
  );

  const imagePool = useMemo(() => {
    const pool = collectPortalHeroImagePool({
      featured: allFeatured,
      templates: publicTemplates,
      cases: portalCases,
    });
    return pickRandomItems(pool, pool.length);
  }, [allFeatured, publicTemplates, portalCases]);

  const [leftIndex, setLeftIndex] = useState(0);
  const [rightIndex, setRightIndex] = useState(1);
  const cursorRef = useRef(0);
  const updateLeftRef = useRef(true);

  useEffect(() => {
    const len = imagePool.length;
    if (len === 0) {
      setLeftIndex(0);
      setRightIndex(0);
      cursorRef.current = 0;
      return;
    }

    const start = Math.floor(Math.random() * len);
    setLeftIndex(start);
    setRightIndex(len > 1 ? (start + 1) % len : start);
    cursorRef.current = len > 1 ? (start + 2) % len : start;
    updateLeftRef.current = true;
  }, [imagePool]);

  useEffect(() => {
    if (imagePool.length <= 1) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      const len = imagePool.length;
      const next = cursorRef.current;
      if (updateLeftRef.current) {
        setLeftIndex(next);
      } else {
        setRightIndex(next);
      }
      cursorRef.current = (next + 1) % len;
      updateLeftRef.current = !updateLeftRef.current;
    }, BG_ROTATE_MS);

    return () => window.clearInterval(timer);
  }, [imagePool]);

  const leftUrl = poolUrlAt(imagePool, leftIndex);
  const rightUrl = poolUrlAt(imagePool, rightIndex);

  useEffect(() => {
    if (!base?.trim()) return;
    setLoading(true);
    void Promise.allSettled([
      listPortalFeaturedProjects(base),
      listCanvasTemplates(base, "public"),
      listPortalCaseProjects(base),
    ])
      .then(([featRes, tplRes, caseRes]) => {
        if (featRes.status === "fulfilled") {
          const list = Array.isArray(featRes.value) ? featRes.value : [];
          setAllFeatured(list.filter((p) => p.edition === "pro2"));
        } else {
          setAllFeatured([]);
        }

        if (tplRes.status === "fulfilled") {
          setPublicTemplates(Array.isArray(tplRes.value) ? tplRes.value : []);
        } else {
          setPublicTemplates([]);
        }

        if (caseRes.status === "fulfilled") {
          const list = Array.isArray(caseRes.value) ? caseRes.value : [];
          setPortalCases(list.filter((c) => c.edition === "pro2"));
        } else {
          setPortalCases([]);
        }
      })
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
        className="relative flex min-h-[22rem] items-center justify-center overflow-hidden rounded-2xl border border-[var(--canvas-border)] bg-[var(--canvas-surface)] px-6 py-16 sm:min-h-[28rem] sm:px-10 sm:py-20"
      >
        <PortalHeroBackdrop leftUrl={leftUrl} rightUrl={rightUrl} />
        <div className="relative z-10 flex flex-col items-center text-center">
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
