"use client";

import { useEffect, useState } from "react";
import { Pin } from "lucide-react";

import { QrKindBrowseSkeleton } from "@/components/quick-replica/qr-panel-skeletons";
import type { QrCategory, QrKindBrowseItem } from "@/lib/qr-template-types";
import { QR_CATEGORIES, QR_PINNED_TOOLS } from "@/lib/qr-template-types";

const PINNED_KINDS = new Set(QR_PINNED_TOOLS.map((t) => t.kind));

function resolveKindMedia(item: QrKindBrowseItem): {
  imageUrl: string | null;
  videoUrl: string | null;
} {
  const t = item.featuredTemplate;
  if (!t) return { imageUrl: null, videoUrl: null };

  const videoUrl =
    t.output?.mediaType === "video"
      ? t.output.url
      : t.reference.slots.referenceVideo?.url ?? null;

  const imageUrl =
    t.thumbnailUrl ||
    t.reference.slots.targetImage?.url ||
    t.reference.slots.sceneImages?.[0]?.url ||
    t.reference.slots.characterRefs?.[0]?.url ||
    null;

  return { imageUrl, videoUrl };
}

function KindCard({
  item,
  selected,
  galleryLoading,
  onSelect,
}: {
  item: QrKindBrowseItem;
  selected: boolean;
  galleryLoading?: boolean;
  onSelect: () => void;
}) {
  const { imageUrl, videoUrl } = resolveKindMedia(item);
  const [mediaReady, setMediaReady] = useState(false);
  const showPin =
    PINNED_KINDS.has(item.kind) ||
    item.featuredTemplate?.badges?.includes("pinned") ||
    Boolean(item.toolKey);

  useEffect(() => {
    setMediaReady(false);
  }, [item.kind, imageUrl, videoUrl]);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`qr-card group relative ${selected ? "qr-card-selected" : ""}${
        selected && galleryLoading ? " qr-card-loading" : ""
      }`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-900">
        {!mediaReady && (imageUrl || videoUrl) ? (
          <div className="qr-skeleton absolute inset-0" aria-hidden />
        ) : null}
        {videoUrl && !imageUrl ? (
          <video
            src={videoUrl}
            muted
            playsInline
            preload="metadata"
            onLoadedData={() => setMediaReady(true)}
            className={`h-full w-full object-cover transition group-hover:scale-[1.02]${mediaReady ? " opacity-100" : " opacity-0"}`}
          />
        ) : imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt={item.label}
            loading="lazy"
            decoding="async"
            onLoad={() => setMediaReady(true)}
            className={`h-full w-full object-cover transition group-hover:scale-[1.02]${mediaReady ? " opacity-100" : " opacity-0"}`}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-zinc-600">
            {item.label}
          </div>
        )}
      </div>

      {showPin ? (
        <span className="qr-badge-pin absolute right-2 top-2 shadow">
          <Pin className="h-3.5 w-3.5" />
        </span>
      ) : null}

      {item.featuredTemplate?.badges?.includes("new") ? (
        <span className="qr-badge-new absolute left-2 top-2">新</span>
      ) : null}

      <div className="px-2 py-2 text-sm font-medium">{item.label}</div>
    </button>
  );
}

type Props = {
  category: QrCategory;
  items: QrKindBrowseItem[];
  selectedKind: string | null;
  loading: boolean;
  templatesLoading?: boolean;
  emptyMessage?: string;
  onSelectKind: (kind: string) => void;
};

export function QrKindBrowsePanel({
  category,
  items,
  selectedKind,
  loading,
  templatesLoading = false,
  emptyMessage,
  onSelectKind,
}: Props) {
  const categoryLabel = QR_CATEGORIES.find((c) => c.id === category)?.label ?? category;
  const showSkeleton = loading && items.length === 0;
  const showRefreshing = loading && items.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="qr-panel-header shrink-0">
        <span>{categoryLabel}</span>
        {loading ? (
          <span className="qr-panel-muted animate-pulse">加载中…</span>
        ) : (
          <span className="qr-panel-muted">{items.length} 类</span>
        )}
      </div>
      <div className="qr-scroll-panel relative min-h-0 flex-1 p-4">
        {showSkeleton ? (
          <QrKindBrowseSkeleton />
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">
            {emptyMessage ?? "该分类暂无类型"}
          </p>
        ) : (
          <div
            className={
              showRefreshing ? "qr-panel-content-pending" : "qr-panel-content-ready"
            }
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {items.map((item) => (
                <KindCard
                  key={item.kind}
                  item={item}
                  selected={selectedKind === item.kind}
                  galleryLoading={
                    selectedKind === item.kind && templatesLoading
                  }
                  onSelect={() => onSelectKind(item.kind)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
