"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  marketModelHref,
  TASK_LABELS,
  type MarketListResponse,
  type MarketModelCard,
} from "@/lib/market-types";

type Props = {
  initial: MarketListResponse;
};

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? "gw-chip-round-active" : "gw-chip-round bg-white/5"}
    >
      {children}
    </button>
  );
}

function CardCover({ model }: { model: MarketModelCard }) {
  const cover = model.coverUrl || "/favicon.ico";
  const isVideo = model.coverUrl?.endsWith(".mp4");

  if (!model.coverUrl) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-[var(--gw-muted)]">
        No preview
      </div>
    );
  }

  if (isVideo) {
    return (
      // 列表卡片不用 <video>，避免 invalid HTML / hydration；用静态图 + 角标
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="https://static.aiquickdraw.com/tools/example/1767694885407_pObJoMcy.png"
        alt={model.displayName}
        className="h-full w-full object-cover transition group-hover:scale-[1.02]"
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={cover}
      alt={model.displayName}
      className="h-full w-full object-cover transition group-hover:scale-[1.02]"
    />
  );
}

function ModelCard({ model }: { model: MarketModelCard }) {
  const router = useRouter();
  const href = marketModelHref(model.canonicalKey);
  const isVideo = model.coverUrl?.endsWith(".mp4");

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
      className="group cursor-pointer overflow-hidden rounded-xl border border-[var(--gw-border)] bg-[var(--gw-surface)] transition hover:border-orange-400/30 hover:bg-[var(--gw-hover)]"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-black/40">
        <CardCover model={model} />
        {isVideo ? (
          <span className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-[var(--gw-ink)]/90">
            VIDEO
          </span>
        ) : null}
        <div className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] text-[var(--gw-ink)]/90">
          {model.providerLabel}
        </div>
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium text-[var(--gw-ink)]">{model.displayName}</h3>
          {model.creditsPerUnit != null ? (
            <span className="shrink-0 text-[10px] text-[var(--gw-accent)]">
              {model.creditsPerUnit} 积分/次
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1">
          {model.taskTags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-[var(--gw-muted)]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

type HeroSlideItem = {
  canonicalKey: string;
  displayName: string;
  coverUrl: string;
  heroUrl?: string;
};

function HeroCarousel({
  slides,
  featured,
}: {
  slides: MarketListResponse["heroSlides"];
  featured: MarketModelCard[];
}) {
  const items = useMemo((): HeroSlideItem[] => {
    if (featured.length) {
      return featured.slice(0, 5).map((m) => ({
        canonicalKey: m.canonicalKey,
        displayName: m.displayName,
        coverUrl: m.coverUrl,
      }));
    }
    return slides.slice(0, 5).map((s) => ({
      canonicalKey: s.canonicalKey,
      displayName: s.canonicalKey,
      coverUrl: "",
      heroUrl: s.heroUrl,
    }));
  }, [featured, slides]);

  const [idx, setIdx] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setIdx((i) => (items.length ? i % items.length : 0));
  }, [items.length, items.map((x) => x.canonicalKey).join("|")]);

  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(
      () => setIdx((i) => (items.length ? (i + 1) % items.length : 0)),
      6000,
    );
    return () => clearInterval(t);
  }, [items.length]);

  if (!items.length) return null;

  const safeIdx = idx % items.length;
  const current = items[safeIdx]!;
  const heroUrl = current.heroUrl || current.coverUrl;
  const title = current.displayName || current.canonicalKey;
  const showVideo = mounted && heroUrl?.endsWith(".mp4");

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--gw-border)] bg-black/40">
      <div className="relative aspect-[21/7] min-h-[160px]">
        {showVideo ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            key={heroUrl}
            src={heroUrl}
            className="absolute inset-0 h-full w-full object-cover opacity-80"
            muted
            loop
            playsInline
            autoPlay
          />
        ) : heroUrl && !heroUrl.endsWith(".mp4") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-80"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="https://static.aiquickdraw.com/tools/example/1767694885407_pObJoMcy.png"
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-80"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
        <div className="absolute bottom-0 left-0 p-6">
          <p className="text-xs uppercase tracking-widest text-[var(--gw-accent)]/90">Featured</p>
          <h2 className="mt-1">{title}</h2>
          <Link
            href={marketModelHref(current.canonicalKey)}
            className="gw-btn mt-4 inline-flex text-sm"
          >
            打开 Playground
          </Link>
        </div>
        {items.length > 1 ? (
          <div className="absolute bottom-4 right-4 flex gap-1.5">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => setIdx(i)}
                className={`h-1.5 rounded-full transition ${
                  i === safeIdx ? "w-6 bg-orange-400" : "w-1.5 bg-white/30"
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function MarketListClient({ initial }: Props) {
  const [q, setQ] = useState("");
  const [provider, setProvider] = useState("all");
  const [task, setTask] = useState("all");
  const [page, setPage] = useState(initial.page || 1);
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);

  const pageSize = 20;

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("page", String(page));
      qs.set("pageSize", String(pageSize));
      if (q.trim()) qs.set("q", q.trim());
      if (provider !== "all") qs.set("provider", provider);
      if (task !== "all") qs.set("task", task);
      const res = await fetch(
        `/api/book-mall/api/gateway/market/models?${qs.toString()}`,
      );
      const json = (await res.json()) as MarketListResponse;
      if (res.ok) setData(json);
    } finally {
      setLoading(false);
    }
  }, [q, provider, task, page]);

  useEffect(() => {
    const t = setTimeout(() => {
      void fetchList();
    }, 300);
    return () => clearTimeout(t);
  }, [fetchList]);

  function onProviderChange(next: string) {
    setProvider(next);
    setPage(1);
  }

  function onTaskChange(next: string) {
    setTask(next);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <HeroCarousel slides={data.heroSlides} featured={data.featured} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <input
          className="gw-input max-w-md"
          placeholder="搜索模型名称、厂商、任务类型…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        {loading ? (
          <span className="text-xs text-[var(--gw-muted)]">刷新中…</span>
        ) : (
          <span className="text-xs text-[var(--gw-muted)]">
            共 {data.total} 个模型 · 第 {data.page}/{data.totalPages} 页
          </span>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--gw-muted)]">
          Provider
        </p>
        <div className="flex flex-wrap gap-2">
          <Chip active={provider === "all"} onClick={() => onProviderChange("all")}>
            All
          </Chip>
          {data.providers.map((p) => (
            <Chip key={p} active={provider === p} onClick={() => onProviderChange(p)}>
              {p}
            </Chip>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--gw-muted)]">Task</p>
        <div className="flex flex-wrap gap-2">
          <Chip active={task === "all"} onClick={() => onTaskChange("all")}>
            All
          </Chip>
          {data.tasks.map((t) => (
            <Chip key={t} active={task === t} onClick={() => onTaskChange(t)}>
              {TASK_LABELS[t] ?? t}
            </Chip>
          ))}
        </div>
      </div>

      {data.models.length === 0 ? (
        <div className="gw-card text-center text-sm text-[var(--gw-muted)]">
          没有匹配的模型。平台代付用户仅展示已上架且有定价的模型；BYOK 用户需先绑定对应厂商凭证。
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.models.map((m) => (
              <ModelCard key={m.canonicalKey} model={m} />
            ))}
          </div>

          {data.totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                className="gw-btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
                disabled={data.page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </button>
              {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={
                    n === data.page
                      ? "gw-chip-round-active min-w-[2rem] px-2.5 py-1.5"
                      : "min-w-[2rem] rounded-lg px-2.5 py-1.5 text-xs text-[var(--gw-muted)] transition hover:bg-[var(--gw-hover)] hover:text-[var(--gw-ink)]"
                  }
                  disabled={loading}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                className="gw-btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
                disabled={data.page >= data.totalPages || loading}
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              >
                下一页
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
