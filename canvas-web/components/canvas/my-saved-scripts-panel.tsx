"use client";

import { useMemo, useState } from "react";
import { BookOpen, Eye, X } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import {
  CANVAS_TOOLBAR_SIDE_PANEL_OVERLAY_CLASS,
  canvasToolbarSidePanelAsideClass,
} from "@/lib/canvas/canvas-toolbar-side-panel";
import {
  CANVAS_PANEL_HEADER_BORDER_CLASS,
  CANVAS_PANEL_HEADER_ICON_CLASS,
  CANVAS_PANEL_ITEM_CARD_CLASS,
  CANVAS_PANEL_ITEM_META_CLASS,
  CANVAS_PANEL_ITEM_TITLE_CLASS,
  CANVAS_PANEL_SECONDARY_BTN_CLASS,
  CANVAS_PANEL_TITLE_CLASS,
} from "@/lib/canvas/canvas-chrome-semantics";
import { cn } from "@/lib/utils";
import {
  collectStoryProSavedScriptsFromCanvas,
  formatFinalizedScriptMetaLine,
  formatFinalizedScriptTitle,
  formatFinalizedScriptVersionLabel,
  hubFinalizedScriptHistoryForItem,
  type StoryProSavedScriptListItem,
} from "@/lib/canvas/story-pro-finalized-script";
import { formatRevisionTime } from "@/lib/canvas/story-revision";
import { StoryProFinalizedScriptModal } from "./story-pro-finalized-script-modal";

export function MySavedScriptsPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const [viewing, setViewing] = useState<StoryProSavedScriptListItem | null>(
    null,
  );

  const items = useMemo(
    () => collectStoryProSavedScriptsFromCanvas(nodes, edges),
    [nodes, edges],
  );

  const viewingHistory = useMemo(() => {
    if (!viewing) return [];
    return hubFinalizedScriptHistoryForItem(nodes, viewing);
  }, [viewing, nodes]);

  if (!open && !viewing) return null;

  return (
    <>
      {open ? (
        <div
          className={`${CANVAS_TOOLBAR_SIDE_PANEL_OVERLAY_CLASS} z-[60]`}
          onClick={onClose}
          role="presentation"
        >
          <aside
            className={canvasToolbarSidePanelAsideClass(
              `border-l ${CANVAS_PANEL_HEADER_BORDER_CLASS}`,
            )}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="我保存的剧本"
          >
            <header
              className={cn(
                "flex items-center justify-between border-b px-4 py-3",
                CANVAS_PANEL_HEADER_BORDER_CLASS,
              )}
            >
              <div className="flex items-center gap-2">
                <BookOpen className={CANVAS_PANEL_HEADER_ICON_CLASS} />
                <p className={CANVAS_PANEL_TITLE_CLASS}>我保存的剧本</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1 text-[var(--canvas-muted)] hover:bg-white/5 hover:text-white"
                aria-label="关闭"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {items.length === 0 ? (
                <p className="text-[12px] leading-relaxed text-[var(--canvas-muted)]">
                  还没有定稿剧本。
                  <br />
                  在「故事剧本」节点完成大纲后点击「故事定稿」，即可在此查看只读历史（含主题与版本号）。
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className={CANVAS_PANEL_ITEM_CARD_CLASS}
                    >
                      <p className={CANVAS_PANEL_ITEM_TITLE_CLASS}>
                        {formatFinalizedScriptTitle(item.snapshot.theme)}
                      </p>
                      <p className={CANVAS_PANEL_ITEM_META_CLASS}>
                        {item.hubLabel} ·{" "}
                        {formatFinalizedScriptVersionLabel(item.snapshot.version)}{" "}
                        · {formatRevisionTime(item.snapshot.finalizedAt)}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[10px] text-[var(--canvas-muted)]">
                        {formatFinalizedScriptMetaLine(
                          item.snapshot.theme,
                          item.snapshot.version,
                          item.snapshot.finalizedAt,
                        )}
                      </p>
                      <button
                        type="button"
                        className={cn(
                          "mt-2 inline-flex w-full items-center justify-center gap-1",
                          CANVAS_PANEL_SECONDARY_BTN_CLASS,
                        )}
                        onClick={() => setViewing(item)}
                      >
                        <Eye className="size-3" />
                        查看（Word 只读）
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      ) : null}

      <StoryProFinalizedScriptModal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        history={viewingHistory}
        initialVersionIndex={viewing?.historyIndex ?? 0}
      />
    </>
  );
}
