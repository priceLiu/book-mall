"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchEcomTemplateGalleryCatalog } from "@/lib/ecom-template-gallery-api";
import type { EcomTemplateGalleryEntry } from "@/lib/ecom-template-gallery/types";
import { cn } from "@/lib/utils";

type Props = {
  selectedId?: string;
  onSelect: (entry: EcomTemplateGalleryEntry) => void;
  category?: "womens" | "cosmetics" | "shoes";
};

/** 专业模式 · 模板重构：从 Gateway 登记的 template-gallery 拉取，禁止硬编码列表 */
export function PosterTemplatePicker({
  selectedId,
  onSelect,
  category = "womens",
}: Props) {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<EcomTemplateGalleryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { catalog, source } = await fetchEcomTemplateGalleryCatalog(category);
        if (cancelled) return;
        const items = (catalog.templates ?? [])
          .filter((t) => t.mediaKind === "image" || !t.mediaKind)
          .slice(0, 48);
        setEntries(items);
        if (source === "local" && items.length === 0) {
          setError("模板清单未就绪，请稍后刷新或前往模板库导入");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "加载模板失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [category]);

  if (loading) {
    return (
      <p className="flex items-center text-xs text-[var(--ecom-muted)]">
        <Loader2 className="mr-1.5 size-3.5 animate-spin" />
        加载电商模板…
      </p>
    );
  }

  if (error) {
    return <p className="text-xs text-red-600">{error}</p>;
  }

  if (entries.length === 0) {
    return <p className="text-xs text-[var(--ecom-muted)]">暂无模板，请先在「电商模板库」导入。</p>;
  }

  return (
    <div className="grid max-h-[220px] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
      {entries.map((entry) => {
        const thumb =
          entry.thumbUrl?.trim() ||
          entry.coverUrl?.trim() ||
          entry.posterUrl?.trim() ||
          entry.mainImageUrl?.trim();
        const selected = selectedId === entry.id;
        return (
          <button
            key={entry.id}
            type="button"
            className={cn(
              "overflow-hidden rounded-lg border text-left transition",
              selected ? "border-[var(--ecom-outline-border)] ring-1 ring-[var(--ecom-ink)]/15" : "border-[var(--ecom-divider)] hover:border-[var(--ecom-border-soft)]",
            )}
            onClick={() => onSelect(entry)}
          >
            {thumb ? (
              <img src={thumb} alt="" className="aspect-[3/4] w-full object-cover" />
            ) : (
              <div className="flex aspect-[3/4] items-center justify-center bg-[var(--ecom-parchment)] text-[10px] text-[var(--ecom-subtle)]">
                无预览
              </div>
            )}
            <p className="truncate px-1 py-1 text-[10px] text-[var(--ecom-muted)]">
              {entry.title?.trim() || entry.id}
            </p>
          </button>
        );
      })}
    </div>
  );
}
