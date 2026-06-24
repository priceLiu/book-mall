"use client";

import { useCallback, useEffect, useState } from "react";
import { ImagePlus, Trash2, UserRound, X } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  deleteCanvasCharacter,
  listCanvasCharacters,
  type CanvasCharacterRecord,
} from "@/lib/canvas-api";
import { CanvasPanelShellLoading } from "@/components/canvas/canvas-panel-shell-loading";
import { CanvasToolbarSidePanelShell } from "@/components/canvas/canvas-toolbar-side-panel-shell";
import {
  invalidateToolbarPanelCache,
  peekToolbarPanelCache,
  toolbarPanelCacheKey,
  writeToolbarPanelCache,
} from "@/lib/canvas/toolbar-panel-cache";
import {
  CANVAS_PANEL_ITEM_CARD_CLASS,
  CANVAS_PANEL_SHELL_BODY_CLASS,
  CANVAS_PANEL_SHELL_ERROR_CLASS,
  CANVAS_PANEL_SHELL_HEADER_CLASS,
  CANVAS_PANEL_SHELL_THUMB_SM_CLASS,
} from "@/lib/canvas/canvas-chrome-semantics";
import { cn } from "@/lib/utils";

export function MyCharactersPanel({
  open,
  onClose,
  onInsertCharacter,
  refreshKey = 0,
}: {
  open: boolean;
  onClose: () => void;
  /** 点击角色：在画布创建图片节点 */
  onInsertCharacter: (character: CanvasCharacterRecord) => void;
  refreshKey?: number;
}) {
  const base = useBookMallBaseUrl();
  const { doubleConfirm, alert } = useDialogs();
  const [characters, setCharacters] = useState<CanvasCharacterRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (opts?: { force?: boolean }) => {
    if (!base) return;
    const cacheKey = toolbarPanelCacheKey("canvas-characters");
    const cached = peekToolbarPanelCache<CanvasCharacterRecord[]>(cacheKey, opts);
    if (cached) {
      setCharacters(cached);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      const list = await listCanvasCharacters(base);
      setCharacters(list);
      writeToolbarPanelCache(cacheKey, list);
      setError(null);
    } catch (e) {
      setCharacters([]);
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    if (!open) return;
    void load({ force: refreshKey > 0 });
  }, [open, load, refreshKey]);

  useEffect(() => {
    const onChanged = () => {
      invalidateToolbarPanelCache("canvas-characters|");
      if (open) void load();
    };
    window.addEventListener("canvas:characters-changed", onChanged);
    return () => window.removeEventListener("canvas:characters-changed", onChanged);
  }, [open, load]);

  const onDelete = async (c: CanvasCharacterRecord) => {
    if (!base) return;
    const ok = await doubleConfirm({
      first: {
        title: "删除角色？",
        message: `将从「我的角色」中移除「${c.name}」。`,
        confirmLabel: "继续",
        danger: true,
      },
      second: {
        title: "再次确认 · 不可恢复",
        message:
          "角色库记录将被永久删除。画布任务历史中的原图不受影响。",
        confirmLabel: "永久删除",
        danger: true,
      },
    });
    if (!ok) return;
    try {
      await deleteCanvasCharacter(base, c.id);
      invalidateToolbarPanelCache("canvas-characters|");
      await load({ force: true });
    } catch (e) {
      await alert({
        title: "删除失败",
        message: e instanceof Error ? e.message : String(e),
        variant: "error",
      });
    }
  };

  return (
    <CanvasToolbarSidePanelShell
      open={open}
      onClose={onClose}
      ariaLabel="我的角色"
    >
        <header className={CANVAS_PANEL_SHELL_HEADER_CLASS}>
          <div className="flex items-center gap-2">
            <UserRound className="size-4 text-[var(--canvas-accent)]" />
            <p className="text-sm font-medium">我的角色</p>
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
          {error ? (
            <p className={CANVAS_PANEL_SHELL_ERROR_CLASS}>{error}</p>
          ) : null}

          {loading ? (
            <CanvasPanelShellLoading />
          ) : characters.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-[12px] text-[var(--canvas-muted)]">
              还没有保存的角色。
              <br />
              在三视图节点生成成功后点「保存角色」即可入库。
            </div>
          ) : (
            <ul className="space-y-2">
              {characters.map((c) => (
                <li key={c.id}>
                  <div
                    className={cn(
                      "flex items-center gap-2 transition hover:bg-black/35",
                      CANVAS_PANEL_ITEM_CARD_CLASS,
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onInsertCharacter(c)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      title="点击在画布创建图片节点"
                    >
                      <div className={cn(CANVAS_PANEL_SHELL_THUMB_SM_CLASS, "size-14 overflow-hidden")}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={c.imageUrl}
                          alt={c.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-white">
                          {c.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[var(--canvas-muted)]">
                          {c.model ? `${c.model} · ` : ""}
                          {new Date(c.updatedAt).toLocaleString("zh-CN")}
                        </p>
                      </div>
                      <ImagePlus className="size-4 shrink-0 text-[var(--canvas-accent)]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete(c)}
                      className="shrink-0 rounded-md p-1.5 text-[var(--canvas-muted)] hover:bg-red-500/10 hover:text-red-300"
                      title="删除角色"
                      aria-label={`删除 ${c.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="border-t border-white/10 px-4 py-2 text-[10px] text-[var(--canvas-muted)]">
          点击角色会在画布上创建一个图片节点，可继续连入工作流。
        </footer>
    </CanvasToolbarSidePanelShell>
  );
}
