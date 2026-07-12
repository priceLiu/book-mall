"use client";

import { RefreshCw } from "lucide-react";

import {
  MasonryTemplateCard,
  distributeToColumns,
  useMasonryColumnCount,
} from "@/components/quick-replica/qr-template-gallery";
import { QrMasonryGallerySkeleton } from "@/components/quick-replica/qr-panel-skeletons";
import { QR_CATEGORIES, getKindDef, type QrTemplate } from "@/lib/qr-template-types";

type Props = {
  templates: QrTemplate[];
  loading: boolean;
  onSelectWork: (template: QrTemplate) => void;
  onRefresh?: () => void;
};

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  QR_CATEGORIES.map((c) => [c.id, c.label]),
);

export function QrHomeWorksPanel({
  templates,
  loading,
  onSelectWork,
  onRefresh,
}: Props) {
  const columnCount = useMasonryColumnCount();
  const columns = distributeToColumns(templates, columnCount);

  const showSkeleton = loading && templates.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="qr-panel-header shrink-0">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium text-[var(--qr-text-primary)]">
            精选作品
          </span>
          <span className="text-xs qr-panel-muted">
            从作品库随机推荐，点击可进入对应分类与模板列表
          </span>
        </div>
        <div className="flex items-center gap-2">
          {loading ? (
            <span className="qr-panel-muted animate-pulse text-xs">加载中…</span>
          ) : (
            <span className="qr-panel-muted text-xs">{templates.length} 项</span>
          )}
          {onRefresh ? (
            <button
              type="button"
              title="换一批"
              onClick={onRefresh}
              disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--qr-border)] text-[var(--qr-text-muted)] transition hover:bg-white/5 hover:text-[var(--qr-text-primary)] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="qr-scroll-panel min-h-0 flex-1 px-2 pb-3 md:px-3 md:pb-4">
        {showSkeleton ? (
          <QrMasonryGallerySkeleton columnCount={columnCount} />
        ) : templates.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="text-sm text-[var(--qr-text-secondary)]">暂无推荐作品</p>
            <p className="text-xs qr-panel-muted">
              可从左侧选择分类浏览，或点击置顶工具开始创作
            </p>
          </div>
        ) : (
          <div
            className={
              loading && templates.length > 0
                ? "qr-panel-content-pending"
                : "qr-panel-content-ready"
            }
          >
            <div className="flex gap-3">
              {columns.map((col, colIndex) => (
                <div key={colIndex} className="flex min-w-0 flex-1 flex-col">
                  {col.map((t) => {
                    const catLabel = CATEGORY_LABEL[t.category] ?? t.category;
                    const kindLabel = getKindDef(t.kind)?.label ?? t.kind;
                    return (
                      <div key={t.id} className="group/card relative mb-3">
                        <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap gap-1">
                          <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] text-white/90 backdrop-blur-sm">
                            {catLabel}
                          </span>
                          <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-white/75 backdrop-blur-sm">
                            {kindLabel}
                          </span>
                        </div>
                        <MasonryTemplateCard
                          template={t}
                          onSelect={() => onSelectWork(t)}
                          naturalAspect={t.category === "world"}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
