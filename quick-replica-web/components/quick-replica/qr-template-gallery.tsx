"use client";

import type { QrCategory, QrTemplate } from "@/lib/qr-template-types";
import { QR_CATEGORIES } from "@/lib/qr-template-types";

function TemplateCard({
  template,
  onSelect,
}: {
  template: QrTemplate;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="qr-card group relative"
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-zinc-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={template.thumbnailUrl}
          alt={template.title}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition group-hover:scale-[1.02]"
        />
      </div>
      <div className="absolute left-2 top-2 flex flex-wrap gap-1">
        {template.badges?.includes("pinned") ? (
          <span className="qr-badge-new">置顶</span>
        ) : null}
        {template.badges?.includes("new") ? (
          <span className="qr-badge-new">新</span>
        ) : null}
        {template.source === "user" ? (
          <span
            className="rounded px-1.5 py-0.5 text-[10px]"
            style={{ background: "var(--qr-brand)", color: "#fff" }}
          >
            我的
          </span>
        ) : null}
      </div>
      <div className="px-2 py-2 text-sm font-medium">{template.title}</div>
    </button>
  );
}

type Props = {
  category: QrCategory | null;
  titleSuffix?: string;
  templates: QrTemplate[];
  loading: boolean;
  onSelectTemplate: (template: QrTemplate) => void;
};

export function QrTemplateGallery({
  category,
  titleSuffix,
  templates,
  loading,
  onSelectTemplate,
}: Props) {
  const categoryLabel = category
    ? QR_CATEGORIES.find((c) => c.id === category)?.label
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="qr-panel-header">
        <span>
          模板
          {categoryLabel ? ` · ${categoryLabel}` : ""}
          {titleSuffix ? ` · ${titleSuffix}` : ""}
        </span>
        {loading ? (
          <span className="qr-panel-muted">加载中…</span>
        ) : (
          <span className="qr-panel-muted">{templates.length} 项</span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {templates.map((t) => (
            <TemplateCard key={t.id} template={t} onSelect={() => onSelectTemplate(t)} />
          ))}
        </div>
        {!loading && templates.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">暂无模板</p>
        ) : null}
      </div>
    </div>
  );
}
