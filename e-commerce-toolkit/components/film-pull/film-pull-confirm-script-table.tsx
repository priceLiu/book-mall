"use client";

import { Plus, Trash2 } from "lucide-react";

import {
  FilmPullRefReadOnlyCell,
  FilmPullRefToggleCell,
} from "@/components/film-pull/film-pull-ref-cells";
import { FilmPullRefsGalleryStrip } from "@/components/film-pull/film-pull-refs-gallery-strip";
import { ProductDesignPromptMentionTextarea } from "@/components/product-design/product-design-prompt-mention-textarea";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import type { EcomPromptImageRef } from "@/lib/ecom-prompt-mention";
import {
  FILM_PULL_PRODUCT_INTERACTION_OPTIONS,
  formatFilmPullConfirmCell,
  formatFilmPullProductInteraction,
  formatFilmPullShotCamera,
  formatFilmPullShotTimeline,
} from "@/lib/film-pull-confirm-table";
import {
  addProductionShotRow,
  deleteProductionShotRow,
} from "@/lib/film-pull-production-script-utils";
import type {
  FilmPullCharacterRef,
  FilmPullProductInteraction,
  FilmPullProductionShot,
  FilmPullRefMatch,
} from "@/lib/film-pull-types";
import {
  listFilmPullModelRefs,
  listFilmPullProductRefs,
  resolveFilmPullShotDisplayRefIds,
} from "@/lib/film-pull-refs";
import { cn } from "@/lib/utils";

export type FilmPullConfirmScriptTableMode = "preview" | "edit";

type Props = {
  shots: FilmPullProductionShot[];
  characterRefs: FilmPullCharacterRef[];
  refMatch?: FilmPullRefMatch | null;
  mode?: FilmPullConfirmScriptTableMode;
  disabled?: boolean;
  onChangeShots?: (shots: FilmPullProductionShot[]) => void;
  mentionRefs?: EcomPromptImageRef[];
  mentionPickerZIndex?: number;
  /** 表头下方展示全部参考图及 @图片N */
  showRefsGallery?: boolean;
  showRowActions?: boolean;
  className?: string;
};

function MentionOrTextarea({
  value,
  edit,
  mentionRefs,
  pickerZIndex,
  disabled,
  minHeightClass,
  onChange,
}: {
  value: string;
  edit: boolean;
  mentionRefs?: EcomPromptImageRef[];
  pickerZIndex?: number;
  disabled?: boolean;
  minHeightClass?: string;
  onChange: (next: string) => void;
}) {
  if (!edit) {
    if (mentionRefs && mentionRefs.length > 0 && /@图片\d+/.test(value)) {
      return (
        <ProductDesignPromptMentionTextarea
          value={value}
          referenceImages={mentionRefs}
          disabled
          hideQuickInsert
          minHeightClass="min-h-[2rem]"
          className="max-w-[12rem] rounded border border-transparent bg-transparent px-0 py-0 text-xs leading-relaxed"
          onChange={() => {}}
        />
      );
    }
    return (
      <span className="block max-w-[12rem] whitespace-pre-wrap break-words">
        {formatFilmPullConfirmCell(value)}
      </span>
    );
  }
  if (mentionRefs && mentionRefs.length > 0) {
    return (
      <ProductDesignPromptMentionTextarea
        value={value}
        referenceImages={mentionRefs}
        disabled={disabled}
        hideQuickInsert
        pickerZIndex={pickerZIndex}
        minHeightClass={minHeightClass ?? "min-h-[3rem]"}
        className="min-w-[10rem] rounded border border-[#d2d2d7] bg-white px-1.5 py-1 text-xs leading-relaxed"
        onChange={onChange}
      />
    );
  }
  return (
    <textarea
      className={`w-full min-w-[10rem] ${minHeightClass ?? "min-h-[3rem]"} rounded border border-[#d2d2d7] px-1.5 py-1 text-xs outline-none focus:border-[#0071e3]`}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function FilmPullConfirmScriptTable({
  shots,
  characterRefs,
  refMatch,
  mode = "preview",
  disabled = false,
  onChangeShots,
  mentionRefs,
  mentionPickerZIndex = 6000,
  showRefsGallery = false,
  showRowActions = false,
  className,
}: Props) {
  const isEdit = mode === "edit";
  const modelRefs = listFilmPullModelRefs(characterRefs);
  const productRefs = listFilmPullProductRefs(characterRefs);
  const colCount = 15 + (showRowActions && isEdit ? 1 : 0);

  function patchShot(shotNo: number, patch: Partial<FilmPullProductionShot>) {
    if (!isEdit || !onChangeShots || disabled) return;
    onChangeShots(
      shots.map((s) => (s.shotNo === shotNo ? { ...s, ...patch } : s)),
    );
  }

  function patchAudio(
    shot: FilmPullProductionShot,
    key: keyof FilmPullProductionShot["audioInfo"],
    value: string,
  ) {
    patchShot(shot.shotNo, {
      audioInfo: { ...shot.audioInfo, [key]: value },
    });
  }

  return (
    <div className={cn("overflow-x-auto rounded-lg border border-[#e8e8ed]", className)}>
      {showRefsGallery ? (
        <div className="border-b border-[#e8e8ed] bg-[#fafafa] px-3 py-2.5">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-[#6e6e73]">
            参考图 · 在 Prompt 中用 @图片1 … 引用
          </p>
          <FilmPullRefsGalleryStrip characterRefs={characterRefs} />
        </div>
      ) : null}
      <table className="w-full min-w-[1600px] border-collapse text-left text-xs">
        <thead>
          <tr className="bg-[#1d1d1f] text-white">
            <th className="px-3 py-2 font-medium">镜号</th>
            <th className="px-3 py-2 font-medium">时间轴</th>
            <th className="px-3 py-2 font-medium">景别</th>
            <th className="px-3 py-2 font-medium">场景</th>
            <th className="px-3 py-2 font-medium">场景 Prompt</th>
            <th className="px-3 py-2 font-medium">动作</th>
            <th className="px-3 py-2 font-medium">产品交互</th>
            <th className="px-3 py-2 font-medium">卖点</th>
            <th className="px-3 py-2 font-medium">口播</th>
            <th className="px-3 py-2 font-medium">运镜</th>
            <th className="px-3 py-2 font-medium">情绪</th>
            <th className="px-3 py-2 font-medium">模特 ref</th>
            <th className="px-3 py-2 font-medium">产品 ref</th>
            <th className="px-3 py-2 font-medium">生图 Prompt</th>
            <th className="px-3 py-2 font-medium">生视频 Prompt</th>
            {showRowActions && isEdit ? (
              <th className="px-3 py-2 font-medium" aria-label="操作" />
            ) : null}
          </tr>
        </thead>
        <tbody>
          {shots.map((shot) => {
            const displayRefs = resolveFilmPullShotDisplayRefIds(shot, {
              characterRefs,
              refMatch,
            });
            return (
            <tr key={shot.shotNo} className="border-t border-[#e8e8ed] align-top">
              <td className="px-3 py-2 font-medium">{shot.shotNo}</td>
              <td className="px-3 py-2 text-[#6e6e73]">{formatFilmPullShotTimeline(shot)}</td>
              <td className="px-3 py-2">
                {isEdit ? (
                  <input
                    className="w-full min-w-[4rem] rounded border border-[#d2d2d7] px-1.5 py-1 text-xs"
                    value={shot.shotScale}
                    disabled={disabled}
                    onChange={(e) => patchShot(shot.shotNo, { shotScale: e.target.value })}
                  />
                ) : (
                  formatFilmPullConfirmCell(shot.shotScale)
                )}
              </td>
              <td className="px-3 py-2">
                {isEdit ? (
                  <textarea
                    className="min-h-[2.5rem] w-full min-w-[6rem] rounded border border-[#d2d2d7] px-1.5 py-1 text-xs"
                    value={shot.sceneEnvironment}
                    disabled={disabled}
                    onChange={(e) => patchShot(shot.shotNo, { sceneEnvironment: e.target.value })}
                  />
                ) : (
                  formatFilmPullConfirmCell(shot.sceneEnvironment)
                )}
              </td>
              <td className="px-3 py-2">
                <MentionOrTextarea
                  value={shot.aiVisualPrompt}
                  edit={isEdit}
                  mentionRefs={mentionRefs}
                  pickerZIndex={mentionPickerZIndex}
                  disabled={disabled}
                  onChange={(next) => patchShot(shot.shotNo, { aiVisualPrompt: next })}
                />
              </td>
              <td className="px-3 py-2">
                {isEdit ? (
                  <textarea
                    className="min-h-[2.5rem] w-full min-w-[6rem] rounded border border-[#d2d2d7] px-1.5 py-1 text-xs"
                    value={shot.subjectBlocking}
                    disabled={disabled}
                    onChange={(e) => patchShot(shot.shotNo, { subjectBlocking: e.target.value })}
                  />
                ) : (
                  formatFilmPullConfirmCell(shot.subjectBlocking)
                )}
              </td>
              <td className="px-3 py-2">
                {isEdit ? (
                  <select
                    className="w-full min-w-[5rem] rounded border border-[#d2d2d7] px-1.5 py-1 text-xs"
                    value={shot.productInteraction ?? "none"}
                    disabled={disabled}
                    onChange={(e) =>
                      patchShot(shot.shotNo, {
                        productInteraction: e.target.value as FilmPullProductInteraction,
                      })
                    }
                  >
                    {FILM_PULL_PRODUCT_INTERACTION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  formatFilmPullProductInteraction(shot)
                )}
              </td>
              <td className="px-3 py-2">
                {isEdit ? (
                  <input
                    className="w-full min-w-[5rem] rounded border border-[#d2d2d7] px-1.5 py-1 text-xs"
                    value={shot.sellpointNote ?? ""}
                    disabled={disabled}
                    onChange={(e) => patchShot(shot.shotNo, { sellpointNote: e.target.value })}
                  />
                ) : (
                  formatFilmPullConfirmCell(shot.sellpointNote)
                )}
              </td>
              <td className="px-3 py-2">
                {isEdit ? (
                  <textarea
                    className="min-h-[2.5rem] w-full min-w-[6rem] rounded border border-[#d2d2d7] px-1.5 py-1 text-xs"
                    value={shot.audioInfo.scriptSubtitle}
                    disabled={disabled}
                    onChange={(e) => patchAudio(shot, "scriptSubtitle", e.target.value)}
                  />
                ) : (
                  formatFilmPullConfirmCell(shot.audioInfo.scriptSubtitle)
                )}
              </td>
              <td className="px-3 py-2">
                {isEdit ? (
                  <input
                    className="w-full min-w-[5rem] rounded border border-[#d2d2d7] px-1.5 py-1 text-xs"
                    value={shot.cameraMovement}
                    disabled={disabled}
                    onChange={(e) => patchShot(shot.shotNo, { cameraMovement: e.target.value })}
                  />
                ) : (
                  formatFilmPullConfirmCell(formatFilmPullShotCamera(shot))
                )}
              </td>
              <td className="px-3 py-2">
                {isEdit ? (
                  <input
                    className="w-full min-w-[4rem] rounded border border-[#d2d2d7] px-1.5 py-1 text-xs"
                    value={shot.audioInfo.vocalEmotion}
                    disabled={disabled}
                    onChange={(e) => patchAudio(shot, "vocalEmotion", e.target.value)}
                  />
                ) : (
                  formatFilmPullConfirmCell(shot.audioInfo.vocalEmotion)
                )}
              </td>
              <td className="px-3 py-2">
                {isEdit ? (
                  <FilmPullRefToggleCell
                    refs={modelRefs}
                    selectedIds={shot.modelRefIds}
                    disabled={disabled}
                    onChange={(ids) => patchShot(shot.shotNo, { modelRefIds: ids })}
                  />
                ) : (
                  <FilmPullRefReadOnlyCell
                    refs={modelRefs}
                    selectedIds={displayRefs.modelRefIds}
                  />
                )}
              </td>
              <td className="px-3 py-2">
                {isEdit ? (
                  <FilmPullRefToggleCell
                    refs={productRefs}
                    selectedIds={shot.productRefIds}
                    disabled={disabled}
                    onChange={(ids) => patchShot(shot.shotNo, { productRefIds: ids })}
                  />
                ) : (
                  <FilmPullRefReadOnlyCell
                    refs={productRefs}
                    selectedIds={displayRefs.productRefIds}
                  />
                )}
              </td>
              <td className="px-3 py-2">
                <MentionOrTextarea
                  value={shot.imagePrompt}
                  edit={isEdit}
                  mentionRefs={mentionRefs}
                  pickerZIndex={mentionPickerZIndex}
                  disabled={disabled}
                  minHeightClass="min-h-[4rem]"
                  onChange={(next) => patchShot(shot.shotNo, { imagePrompt: next })}
                />
              </td>
              <td className="px-3 py-2">
                <MentionOrTextarea
                  value={shot.videoPrompt}
                  edit={isEdit}
                  mentionRefs={mentionRefs}
                  pickerZIndex={mentionPickerZIndex}
                  disabled={disabled}
                  minHeightClass="min-h-[4rem]"
                  onChange={(next) => patchShot(shot.shotNo, { videoPrompt: next })}
                />
              </td>
              {showRowActions && isEdit ? (
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="flex size-8 items-center justify-center rounded-lg text-[#86868b] hover:bg-[#fff5f5] hover:text-[#ff3b30] disabled:opacity-30"
                    disabled={disabled || shots.length <= 1}
                    title="删除本镜"
                    onClick={() => {
                      if (!onChangeShots) return;
                      onChangeShots(deleteProductionShotRow(shots, shot.shotNo));
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </td>
              ) : null}
            </tr>
            );
          })}
        </tbody>
        {showRowActions && isEdit ? (
          <tfoot>
            <tr className="border-t border-[#e8e8ed] bg-[#fafafa]">
              <td colSpan={colCount} className="px-3 py-2.5">
                <EcomButtonSecondary
                  type="button"
                  size="sm"
                  disabled={disabled}
                  onClick={() => onChangeShots?.(addProductionShotRow(shots))}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  增加分镜
                </EcomButtonSecondary>
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
