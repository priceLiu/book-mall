"use client";

import { useEffect, useMemo, useState } from "react";

import { useMasonryColumnCount } from "@/components/quick-replica/qr-template-gallery";
import { QrWorldGalleryCard } from "@/components/quick-replica/qr-world-gallery-card";
import { QrWorldPromptOmnibox } from "@/components/quick-replica/qr-world-prompt-omnibox";
import { QrWorldViewer } from "@/components/quick-replica/qr-world-viewer";
import { QrMasonryGallerySkeleton } from "@/components/quick-replica/qr-panel-skeletons";
import {
  filterWorldTemplates,
  WORLD_GALLERY_TABS,
  type WorldGalleryTabId,
} from "@/lib/qr-world-gallery-tabs";
import { useIntersectionVisible } from "@/lib/use-intersection-visible";
import type { QrTemplate, QrWorkspaceDraft } from "@/lib/qr-template-types";

type Props = {
  templates: QrTemplate[];
  loading: boolean;
  draft: QrWorkspaceDraft;
  onDraftChange: (draft: QrWorkspaceDraft) => void;
  omniboxExpanded: boolean;
  onOmniboxExpandedChange: (expanded: boolean) => void;
  onApplyTemplate: (template: QrTemplate) => void;
  onGenerate: (draft: QrWorkspaceDraft) => void;
  generating: boolean;
  onToast?: (message: string) => void;
};

export function QrWorldBrowsePanel({
  templates,
  loading,
  draft,
  onDraftChange,
  omniboxExpanded,
  onOmniboxExpandedChange,
  onApplyTemplate,
  onGenerate,
  generating,
  onToast,
}: Props) {
  const [activeTab, setActiveTab] = useState<WorldGalleryTabId>("all");
  const [viewingTemplate, setViewingTemplate] = useState<QrTemplate | null>(null);
  const columnCount = useMasonryColumnCount();

  const filtered = useMemo(
    () => filterWorldTemplates(templates, activeTab),
    [templates, activeTab],
  );

  /** 内置场景库约 48 条；超过阈值再懒加载，避免首屏只出 30 张 */
  const lazyLoadThreshold = 80;
  const shouldLazyLoad = filtered.length > lazyLoadThreshold;
  const pageSize = columnCount * 6;
  const batchSize = columnCount * 5;
  const [visibleCount, setVisibleCount] = useState(() =>
    shouldLazyLoad ? pageSize : filtered.length,
  );

  useEffect(() => {
    setVisibleCount(shouldLazyLoad ? pageSize : filtered.length);
  }, [activeTab, templates, filtered.length, shouldLazyLoad, pageSize]);

  const visibleTemplates = filtered.slice(0, visibleCount);

  const columnClass =
    columnCount >= 5
      ? "columns-2 sm:columns-3 lg:columns-4 xl:columns-5"
      : columnCount >= 4
        ? "columns-2 sm:columns-3 lg:columns-4"
        : columnCount >= 3
          ? "columns-2 md:columns-3"
          : "columns-2";

  const { ref: loadMoreRef, visible: loadMoreVisible } =
    useIntersectionVisible<HTMLDivElement>("480px 0px");

  useEffect(() => {
    if (!shouldLazyLoad || !loadMoreVisible || visibleCount >= filtered.length) return;
    setVisibleCount((c) => Math.min(c + batchSize, filtered.length));
  }, [shouldLazyLoad, loadMoreVisible, visibleCount, filtered.length, batchSize]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {viewingTemplate ? (
        <QrWorldViewer
          template={viewingTemplate}
          onClose={() => setViewingTemplate(null)}
          onEditPrompt={(t) => {
            onApplyTemplate(t);
          }}
          onToast={onToast}
        />
      ) : null}
      <div className="sticky top-0 z-20 flex flex-col items-center gap-3 bg-[var(--qr-bg-page)]/85 px-3 pb-3 pt-4 backdrop-blur-xl md:px-4">
        <QrWorldPromptOmnibox
          draft={draft}
          onDraftChange={onDraftChange}
          expanded={omniboxExpanded}
          onExpandedChange={onOmniboxExpandedChange}
          generating={generating}
          presetTemplates={templates}
          onToast={onToast}
          overlayZIndex={viewingTemplate ? 112 : 60}
          onGenerate={() => onGenerate({ ...draft, kind: "create-world", category: "world" })}
        />

        <div className="flex w-full max-w-6xl justify-center">
          <div className="hide-scrollbar w-full max-w-[1152px] overflow-x-auto">
            <div className="flex w-max min-w-full items-center justify-center gap-2 px-1 md:w-full md:justify-center">
              {WORLD_GALLERY_TABS.map((tab) => {
                const active = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    title={tab.title}
                    onClick={() => setActiveTab(tab.id)}
                    className={`shrink-0 rounded-md px-3 py-2.5 text-sm transition ring-1 ring-white/[0.08] backdrop-blur-xl 2xl:px-4 ${
                      active
                        ? "bg-white text-black"
                        : "bg-white/[0.06] text-[var(--qr-text-primary)] hover:bg-white/[0.1]"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-6xl flex-1 px-3 pb-10 pt-2 md:px-4">
        {loading && templates.length === 0 ? (
          <QrMasonryGallerySkeleton columnCount={columnCount} />
        ) : filtered.length === 0 ? (
          <div className="flex min-h-[240px] items-center justify-center text-sm text-[var(--qr-text-muted)]">
            暂无场景模板
          </div>
        ) : (
          <>
            <div
              className={`${columnClass}`}
              style={{ columnGap: "1rem" }}
            >
              {visibleTemplates.map((template) => (
                <div key={template.id} className="mb-4 break-inside-avoid">
                  <QrWorldGalleryCard
                    template={template}
                    onSelect={() => setViewingTemplate(template)}
                  />
                </div>
              ))}
            </div>

            {shouldLazyLoad && visibleCount < filtered.length ? (
              <div ref={loadMoreRef} className="flex justify-center py-8">
                <span className="text-xs text-[var(--qr-text-muted)]">加载更多…</span>
              </div>
            ) : (
              <div aria-hidden className="h-1 w-full" />
            )}
          </>
        )}
      </div>
    </div>
  );
}
