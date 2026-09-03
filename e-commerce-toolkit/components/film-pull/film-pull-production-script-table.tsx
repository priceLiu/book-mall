"use client";

import { Plus, Trash2 } from "lucide-react";

import {
  FilmPullRefReadOnlyCell,
  FilmPullRefToggleCell,
} from "@/components/film-pull/film-pull-ref-cells";
import { ProductDesignPromptMentionTextarea } from "@/components/product-design/product-design-prompt-mention-textarea";
import {
  ecomDataTableBodyRowClass,
  ecomDataTableClass,
  ecomDataTableHeadRowClass,
  ecomDataTableTdClass,
  ecomDataTableThClass,
  ecomDataTableWrapClass,
} from "@/components/ui/ecom-data-table";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  FILM_PULL_SHOT_TABLE_COLUMNS,
  asFilmPullProductionShotColumn,
  type FilmPullProductionShotColumnDef,
} from "@/components/film-pull/film-pull-shot-table";
import type { EcomPromptImageRef } from "@/lib/ecom-prompt-mention";
import {
  addProductionShotRow,
  deleteProductionShotRow,
} from "@/lib/film-pull-production-script-utils";
import type { FilmPullCharacterRef, FilmPullProductionShot, FilmPullRefMatch } from "@/lib/film-pull-types";
import {
  listFilmPullModelRefs,
  listFilmPullProductRefs,
  resolveFilmPullShotDisplayRefIds,
} from "@/lib/film-pull-refs";
import { cn } from "@/lib/utils";

export type FilmPullProductionScriptTableMode = "preview" | "edit";

type Props = {
  shots: FilmPullProductionShot[];
  characterRefs: FilmPullCharacterRef[];
  refMatch?: FilmPullRefMatch | null;
  /** preview：只读；edit：可编辑（配合 onChangeShots） */
  mode?: FilmPullProductionScriptTableMode;
  disabled?: boolean;
  /** edit 模式：本地批量更新 */
  onChangeShots?: (shots: FilmPullProductionShot[]) => void;
  /** preview 模式可选：逐镜 PATCH（制作成片等场景） */
  onPatchShot?: (shotNo: number, patch: Partial<FilmPullProductionShot>) => void;
  /** @图片N 引用目录；edit 模式下用于 Prompt 列 */
  mentionRefs?: EcomPromptImageRef[];
  /** @ 选择器 z-index（全屏弹层内建议 6000+） */
  mentionPickerZIndex?: number;
  /** edit 模式下是否可改入点/出点/时长（增删镜时需要） */
  editableTimeFields?: boolean;
  showRowActions?: boolean;
  className?: string;
};

const TIME_FIELD_KEYS = new Set(["shotNo", "startTimeSec", "endTimeSec", "durationSec"]);

function patchHasChanges(
  shot: FilmPullProductionShot,
  patch: Partial<FilmPullProductionShot>,
): boolean {
  for (const [key, val] of Object.entries(patch)) {
    const k = key as keyof FilmPullProductionShot;
    const cur = shot[k];
    if (Array.isArray(val) && Array.isArray(cur)) {
      if (val.length !== cur.length || val.some((item, i) => item !== cur[i])) return true;
      continue;
    }
    if (cur !== val) return true;
  }
  return false;
}

const MENTION_FIELD_CLASS =
  "min-w-[10rem] rounded border border-[#d2d2d7] bg-white px-1.5 py-1 text-xs leading-relaxed";

function ScriptMentionField({
  value,
  mentionRefs,
  disabled,
  minHeightClass = "min-h-[3rem]",
  pickerZIndex,
  onChange,
}: {
  value: string;
  mentionRefs: EcomPromptImageRef[];
  disabled?: boolean;
  minHeightClass?: string;
  pickerZIndex?: number;
  onChange: (next: string) => void;
}) {
  return (
    <ProductDesignPromptMentionTextarea
      value={value}
      referenceImages={mentionRefs}
      disabled={disabled}
      hideQuickInsert
      pickerZIndex={pickerZIndex}
      minHeightClass={minHeightClass}
      className={MENTION_FIELD_CLASS}
      onChange={onChange}
    />
  );
}

function ScriptTextField({
  value,
  multiline,
  disabled,
  minHeightClass = "min-h-[3rem]",
  onChange,
}: {
  value: string;
  multiline?: boolean;
  disabled?: boolean;
  minHeightClass?: string;
  onChange: (next: string) => void;
}) {
  if (multiline) {
    return (
      <textarea
        className={`w-full ${minHeightClass} rounded border border-[#d2d2d7] px-1.5 py-1 text-xs outline-none focus:border-[#0071e3]`}
        rows={2}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <input
      className="w-full rounded border border-[#d2d2d7] px-1.5 py-1 text-xs outline-none focus:border-[#0071e3]"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function FilmPullProductionScriptTable({
  shots,
  characterRefs,
  refMatch,
  mode = "preview",
  disabled = false,
  onChangeShots,
  onPatchShot,
  mentionRefs,
  mentionPickerZIndex = 6000,
  editableTimeFields = false,
  showRowActions = false,
  className,
}: Props) {
  const isEdit = mode === "edit";
  const modelRefs = listFilmPullModelRefs(characterRefs);
  const productRefs = listFilmPullProductRefs(characterRefs);

  const columnCount =
    FILM_PULL_SHOT_TABLE_COLUMNS.length + 4 + (showRowActions ? 1 : 0);

  function patchShotLocal(shotNo: number, patch: Partial<FilmPullProductionShot>) {
    if (!isEdit || !onChangeShots || disabled) return;
    const current = shots.find((s) => s.shotNo === shotNo);
    if (!current || !patchHasChanges(current, patch)) return;
    onChangeShots(
      shots.map((s) => (s.shotNo === shotNo ? { ...s, ...patch } : s)),
    );
  }

  function replaceShotRow(shotNo: number, next: FilmPullProductionShot) {
    if (!isEdit || !onChangeShots || disabled) return;
    const current = shots.find((s) => s.shotNo === shotNo);
    if (!current || JSON.stringify(current) === JSON.stringify(next)) return;
    onChangeShots(shots.map((s) => (s.shotNo === shotNo ? next : s)));
  }

  function patchField(
    shot: FilmPullProductionShot,
    col: FilmPullProductionShotColumnDef,
    value: string,
  ) {
    if (!col.set || disabled) return;
    if (TIME_FIELD_KEYS.has(col.key) && !editableTimeFields) return;
    const next = col.set(shot, value);
    if (isEdit && onChangeShots) {
      replaceShotRow(shot.shotNo, next);
    } else if (onPatchShot) {
      onPatchShot(shot.shotNo, next);
    }
  }

  function renderEditableField(
    shot: FilmPullProductionShot,
    col: FilmPullProductionShotColumnDef,
    value: string,
    opts?: { multiline?: boolean; minHeightClass?: string },
  ) {
    const multiline = opts?.multiline ?? Boolean(col.multiline);
    const useMention = Boolean(isEdit && mentionRefs && mentionRefs.length > 0 && multiline);

    if (useMention && mentionRefs) {
      return (
        <ScriptMentionField
          value={value}
          mentionRefs={mentionRefs}
          disabled={disabled}
          pickerZIndex={mentionPickerZIndex}
          minHeightClass={opts?.minHeightClass ?? (col.multiline ? "min-h-[3rem]" : "min-h-[2rem]")}
          onChange={(next) => patchField(shot, col, next)}
        />
      );
    }

    return (
      <ScriptTextField
        value={value}
        multiline={multiline}
        disabled={disabled}
        minHeightClass={opts?.minHeightClass}
        onChange={(next) => patchField(shot, col, next)}
      />
    );
  }

  function isColumnEditable(col: (typeof FILM_PULL_SHOT_TABLE_COLUMNS)[number]) {
    if (!col.set || disabled) return false;
    if (mode === "preview") return false;
    if (TIME_FIELD_KEYS.has(col.key)) return editableTimeFields;
    return true;
  }

  return (
    <div className={cn(ecomDataTableWrapClass, className)}>
      <table className={cn("min-w-[4200px] w-full", ecomDataTableClass)}>
        <thead>
          <tr className={ecomDataTableHeadRowClass}>
            {FILM_PULL_SHOT_TABLE_COLUMNS.map((col) => (
              <th key={col.key} className={cn(ecomDataTableThClass, col.minW, "whitespace-nowrap")}>
                {col.label}
              </th>
            ))}
            <th className={cn(ecomDataTableThClass, "min-w-[120px]")}>模特 ref</th>
            <th className={cn(ecomDataTableThClass, "min-w-[120px]")}>产品 ref</th>
            <th className={cn(ecomDataTableThClass, "min-w-[200px]")}>生图 Prompt</th>
            <th className={cn(ecomDataTableThClass, "min-w-[200px]")}>生视频 Prompt</th>
            {showRowActions ? (
              <th className={cn(ecomDataTableThClass, "min-w-[44px]")} aria-label="操作" />
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
            <tr key={shot.shotNo} className={ecomDataTableBodyRowClass}>
              {FILM_PULL_SHOT_TABLE_COLUMNS.map((col) => {
                const value = col.get(shot);
                const canEdit = isColumnEditable(col);
                return (
                  <td key={col.key} className={cn(ecomDataTableTdClass, col.minW)}>
                    {canEdit ? (
                      renderEditableField(shot, asFilmPullProductionShotColumn(col), value)
                    ) : (
                      <span className="block whitespace-pre-wrap break-words">
                        {value?.trim() ? value : "--"}
                      </span>
                    )}
                  </td>
                );
              })}
              <td className={ecomDataTableTdClass}>
                {isEdit ? (
                  <FilmPullRefToggleCell
                    refs={modelRefs}
                    selectedIds={shot.modelRefIds}
                    disabled={disabled}
                    onChange={(ids) => patchShotLocal(shot.shotNo, { modelRefIds: ids })}
                  />
                ) : (
                  <FilmPullRefReadOnlyCell
                    refs={modelRefs}
                    selectedIds={displayRefs.modelRefIds}
                  />
                )}
              </td>
              <td className={ecomDataTableTdClass}>
                {isEdit ? (
                  <FilmPullRefToggleCell
                    refs={productRefs}
                    selectedIds={shot.productRefIds}
                    disabled={disabled}
                    onChange={(ids) => patchShotLocal(shot.shotNo, { productRefIds: ids })}
                  />
                ) : (
                  <FilmPullRefReadOnlyCell
                    refs={productRefs}
                    selectedIds={displayRefs.productRefIds}
                  />
                )}
              </td>
              <td className={ecomDataTableTdClass}>
                {isEdit ? (
                  renderEditableField(shot, {
                    key: "imagePrompt",
                    label: "生图 Prompt",
                    minW: "min-w-[200px]",
                    multiline: true,
                    get: (r) => r.imagePrompt,
                    set: (r, v) => ({ ...r, imagePrompt: v }),
                  }, shot.imagePrompt, { minHeightClass: "min-h-[4rem]" })
                ) : (
                  <span className="block min-w-[10rem] whitespace-pre-wrap break-words text-xs">
                    {shot.imagePrompt?.trim() ? shot.imagePrompt : "--"}
                  </span>
                )}
              </td>
              <td className={ecomDataTableTdClass}>
                {isEdit ? (
                  renderEditableField(shot, {
                    key: "videoPrompt",
                    label: "生视频 Prompt",
                    minW: "min-w-[200px]",
                    multiline: true,
                    get: (r) => r.videoPrompt,
                    set: (r, v) => ({ ...r, videoPrompt: v }),
                  }, shot.videoPrompt, { minHeightClass: "min-h-[4rem]" })
                ) : (
                  <span className="block min-w-[10rem] whitespace-pre-wrap break-words text-xs">
                    {shot.videoPrompt?.trim() ? shot.videoPrompt : "--"}
                  </span>
                )}
              </td>
              {showRowActions ? (
                <td className={ecomDataTableTdClass}>
                  <button
                    type="button"
                    className="flex size-8 items-center justify-center rounded-lg text-[#86868b] transition hover:bg-[#fff5f5] hover:text-[#ff3b30] disabled:cursor-not-allowed disabled:opacity-30"
                    disabled={disabled || shots.length <= 1}
                    title={shots.length <= 1 ? "至少保留一镜" : "删除本镜"}
                    aria-label={`删除镜 ${shot.shotNo}`}
                    onClick={() => {
                      if (!onChangeShots || disabled) return;
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
              <td colSpan={columnCount} className="px-3 py-2.5">
                <EcomButtonSecondary
                  type="button"
                  size="sm"
                  disabled={disabled}
                  onClick={() => {
                    if (!onChangeShots || disabled) return;
                    onChangeShots(addProductionShotRow(shots));
                  }}
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
