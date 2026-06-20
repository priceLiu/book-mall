"use client";

import { Pin } from "lucide-react";

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
  onSelect,
}: {
  item: QrKindBrowseItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const { imageUrl, videoUrl } = resolveKindMedia(item);
  const showPin =
    PINNED_KINDS.has(item.kind) ||
    item.featuredTemplate?.badges?.includes("pinned") ||
    Boolean(item.toolKey);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`qr-card group relative ${selected ? "qr-card-selected" : ""}`}
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-zinc-900">
        {videoUrl && !imageUrl ? (
          <video
            src={videoUrl}
            muted
            playsInline
            preload="metadata"
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt={item.label}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
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
  emptyMessage?: string;
  onSelectKind: (kind: string) => void;
};

export function QrKindBrowsePanel({
  category,
  items,
  selectedKind,
  loading,
  emptyMessage,
  onSelectKind,
}: Props) {
  const categoryLabel = QR_CATEGORIES.find((c) => c.id === category)?.label ?? category;

  return (
    <div className="flex h-full flex-col">
      <div className="qr-panel-header">
        <span>{categoryLabel}</span>
        {loading ? (
          <span className="qr-panel-muted">加载中…</span>
        ) : (
          <span className="qr-panel-muted">{items.length} 类</span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading && items.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">加载中…</p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">
            {emptyMessage ?? "该分类暂无类型"}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {items.map((item) => (
              <KindCard
                key={item.kind}
                item={item}
                selected={selectedKind === item.kind}
                onSelect={() => onSelectKind(item.kind)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
