"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { FilmPullConfirmScriptTable } from "@/components/film-pull/film-pull-confirm-script-table";
import { FilmPullRefsGalleryStrip } from "@/components/film-pull/film-pull-refs-gallery-strip";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { EcomFullScreenOverlay } from "@/components/ui/ecom-full-screen-overlay";
import { buildFilmPullMentionRefs } from "@/lib/film-pull-mention-refs";
import {
  cloneProductionShots,
  productionShotsSnapshotEqual,
  renumberProductionShots,
} from "@/lib/film-pull-production-script-utils";
import type { FilmPullCharacterRef, FilmPullProductionShot } from "@/lib/film-pull-types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  shots: FilmPullProductionShot[];
  characterRefs: FilmPullCharacterRef[];
  saving?: boolean;
  onSave: (shots: FilmPullProductionShot[]) => void | Promise<void>;
};

/**
 * 全屏制作脚本表编辑弹层（可复用：增删镜、@ 引用、批量保存前本地 draft）
 */
export function FilmPullProductionScriptEditDialog({
  open,
  onOpenChange,
  title = "编辑制作脚本",
  description = "修改确认脚本各列、参考图与生图/生视频 Prompt；支持 @图片N 引用。保存后更新工作台。",
  shots,
  characterRefs,
  saving = false,
  onSave,
}: Props) {
  const { confirm } = useDialogs();
  const [draftShots, setDraftShots] = useState<FilmPullProductionShot[]>(() =>
    cloneProductionShots(shots),
  );
  const [tableReady, setTableReady] = useState(false);

  const mentionRefs = useMemo(
    () => buildFilmPullMentionRefs(characterRefs),
    [characterRefs],
  );

  useEffect(() => {
    if (!open) {
      setTableReady(false);
      return;
    }
    setDraftShots(cloneProductionShots(shots));
    const id = requestAnimationFrame(() => setTableReady(true));
    return () => cancelAnimationFrame(id);
  }, [open, shots]);

  const dirty = useMemo(
    () => !productionShotsSnapshotEqual(draftShots, shots),
    [draftShots, shots],
  );

  const requestClose = useCallback(async () => {
    if (saving) return;
    if (dirty) {
      const ok = await confirm({
        title: "放弃未保存的修改？",
        message: "关闭后本次编辑不会写入制作脚本。",
        confirmLabel: "放弃",
        variant: "destructive",
      });
      if (!ok) return;
    }
    onOpenChange(false);
  }, [confirm, dirty, onOpenChange, saving]);

  async function handleSave() {
    const normalized = renumberProductionShots(draftShots);
    await onSave(normalized);
  }

  return (
    <EcomFullScreenOverlay
      open={open}
      onClose={() => void requestClose()}
      title={title}
      description={description}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <EcomButtonSecondary type="button" disabled={saving} onClick={() => void requestClose()}>
            关闭
          </EcomButtonSecondary>
          <EcomButtonPrimary type="button" disabled={saving || !dirty} onClick={() => void handleSave()}>
            {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            保存
          </EcomButtonPrimary>
        </div>
      }
    >
      <div className="shrink-0 border-b border-[#e8e8ed] bg-[#fafafa] px-5 py-3">
        <p className="mb-2 text-[11px] font-medium text-[#6e6e73]">参考图 · Prompt 可 @ 引用</p>
        <FilmPullRefsGalleryStrip characterRefs={characterRefs} />
      </div>

      <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-auto px-5 py-3">
        {tableReady ? (
          <FilmPullConfirmScriptTable
            mode="edit"
            shots={draftShots}
            characterRefs={characterRefs}
            disabled={saving}
            mentionRefs={mentionRefs}
            mentionPickerZIndex={7000}
            showRowActions
            onChangeShots={setDraftShots}
          />
        ) : (
          <div className="flex min-h-[12rem] items-center justify-center text-sm text-[#86868b]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            加载编辑表…
          </div>
        )}
      </div>
    </EcomFullScreenOverlay>
  );
}
