"use client";

import { useMemo, useState } from "react";
import { BookOpen, Eye, X } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import { CanvasToolbarSidePanelShell } from "@/components/canvas/canvas-toolbar-side-panel-shell";
import {
  CANVAS_PANEL_ITEM_CARD_CLASS,
  CANVAS_PANEL_ITEM_META_CLASS,
  CANVAS_PANEL_ITEM_TITLE_CLASS,
  CANVAS_PANEL_SHELL_BODY_CLASS,
  CANVAS_PANEL_SHELL_HEADER_CLASS,
  CANVAS_PANEL_SHELL_LINK_BTN_CLASS,
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
        <CanvasToolbarSidePanelShell
          open={open}
          onClose={onClose}
          ariaLabel="我保存的剧本"
        >
            <header className={CANVAS_PANEL_SHELL_HEADER_CLASS}>
              <div className="flex items-center gap-2">
                <BookOpen className="size-4 text-[var(--canvas-accent)]" />
                <p className="text-sm font-medium">我保存的剧本</p>
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

            <div className={CANVAS_PANEL_SHELL_BODY_CLASS}>
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
                        CANVAS_PANEL_SHELL_LINK_BTN_CLASS,
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
        </CanvasToolbarSidePanelShell>
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
