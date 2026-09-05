"use client";

import { Fragment, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";

import type { Pro2ShotAnalysis } from "@/lib/canvas/data/pro2-production-script-schema";
import {
  formatPro2ShotTimingLabel,
  Pro2ShotAnalysisFold,
  shotHasPro2Analysis,
} from "@/components/canvas/pro2/pro2-shot-analysis-fold";

import {
  formatStoryboardTableMarkdown,
  isV2StoryboardTableMd,
  parseStoryboardRows,
  type StoryboardTableRow as ParsedStoryboardRow,
} from "@/lib/canvas/parse-md-tables";

export type StoryboardTableRow = ParsedStoryboardRow;
import {
  storyMdTableWrapperClass,
  storyMdTdClass,
  storyMdThClass,
} from "@/lib/canvas/story-md-table-chrome";
import { storyTableTextareaRows } from "@/lib/canvas/story-table-textarea-rows";
import {
  STORY_PRO2_UI_STORYBOARD_AI_IMAGE_LABEL,
  STORY_PRO2_UI_STORYBOARD_AI_VIDEO_LABEL,
} from "@/lib/canvas/data/pro2-production-pack-standard";

export function storyboardRowsFromMd(md: string): StoryboardTableRow[] {
  return parseStoryboardRows(md);
}

export function canEditStoryboardAsTable(md: string): boolean {
  const t = md.trim();
  if (!t) return true;
  return storyboardRowsFromMd(md).length > 0;
}

const FIELD =
  "block w-full min-h-[2.75rem] resize-y border-0 bg-transparent outline-none ring-0 whitespace-pre-wrap break-words placeholder:text-neutral-400 focus:bg-amber-50/50";

type StoryStoryboardTableEditorProps = {
  value: string;
  onChange: (md: string) => void;
  /** Pro2 默认 v2 导演表；auto 按表头识别 v1/v2 */
  variant?: "v1" | "v2" | "auto";
  /** 专业版 / 拉片：按镜号展示时段与折叠详情 */
  shotAnalysisByIndex?: Record<number, Pro2ShotAnalysis | undefined>;
  showIndustrialExtras?: boolean;
};

/** 专业版分镜编辑表（v2 导演表 10 列 · v1 兼容 9 列） */
export function StoryStoryboardTableEditor({
  value,
  onChange,
  variant = "auto",
  shotAnalysisByIndex,
  showIndustrialExtras = false,
}: StoryStoryboardTableEditorProps) {
  const rows = useMemo(() => storyboardRowsFromMd(value), [value]);
  const useV2 = useMemo(() => {
    if (variant === "v2") return true;
    if (variant === "v1") return false;
    return isV2StoryboardTableMd(value);
  }, [variant, value]);
  const tableVariant = "editor" as const;
  const TABLE = storyMdTableWrapperClass(tableVariant);
  const TH = storyMdThClass(tableVariant);
  const TD = `${storyMdTdClass(tableVariant)} p-0`;
  const showTiming =
    showIndustrialExtras ||
    Boolean(
      shotAnalysisByIndex &&
        Object.values(shotAnalysisByIndex).some((a) => shotHasPro2Analysis(a)),
    );
  const v2ColSpan = showTiming ? 12 : 11;

  const commit = (next: StoryboardTableRow[]) => {
    onChange(
      formatStoryboardTableMarkdown(next, {
        format: useV2 ? "pro" : "pro-v1",
      }),
    );
  };

  const patchRow = (index: number, patch: Partial<StoryboardTableRow>) => {
    commit(
      rows.map((r, i) =>
        i === index
          ? {
              ...r,
              ...patch,
              videoPrompt:
                patch.aiVideoPrompt !== undefined
                  ? patch.aiVideoPrompt
                  : patch.videoPrompt !== undefined
                    ? patch.videoPrompt
                    : r.videoPrompt,
            }
          : r,
      ),
    );
  };

  const addRow = () => {
    const nextIndex =
      rows.length > 0 ? Math.max(...rows.map((r) => r.frameIndex)) + 1 : 1;
    commit([
      ...rows,
      useV2
        ? {
            frameIndex: nextIndex,
            scene: "",
            shotSize: "",
            lighting: "",
            cameraMove: "",
            description: "",
            propNames: "—",
            dialogue: "—",
            duration: "",
            sfxNote: "—",
            lipSyncNote: "",
            frameImagePrompt: "",
            aiImagePrompt: "",
            aiVideoPrompt: "",
            videoPrompt: "",
          }
        : {
            frameIndex: nextIndex,
            scene: "",
            shotSize: "",
            lighting: "",
            cameraMove: "",
            description: "",
            dialogue: "—",
            duration: "",
            propNames: "",
            sfxNote: "",
            aiImagePrompt: "",
            aiVideoPrompt: "",
            lipSyncNote: "",
            videoPrompt: "",
            frameImagePrompt: "",
          },
    ]);
  };

  const removeRow = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    commit(
      next.map((r, i) => ({
        ...r,
        frameIndex: i + 1,
      })),
    );
  };

  if (useV2) {
    return (
      <div className="nodrag flex min-h-0 w-full flex-1 flex-col gap-3">
        <p className="text-[12px] text-neutral-500">
          点击单元格编辑；Pass1 导演表（光影/道具/音效），保存不丢列。
        </p>
        <div className="overflow-x-auto overflow-y-visible">
          <table className={TABLE}>
            <colgroup>
              <col className="w-[64px]" />
              <col className="min-w-[72px]" />
              <col className="min-w-[88px]" />
              <col className="min-w-[72px]" />
              <col className="min-w-[220px]" />
              <col className="min-w-[100px]" />
              <col className="min-w-[140px]" />
              <col className="w-[64px]" />
              {showTiming ? <col className="min-w-[88px]" /> : null}
              <col className="min-w-[88px]" />
              <col className="min-w-[120px]" />
              <col className="w-9" />
            </colgroup>
            <thead>
              <tr>
                <th className={TH}>镜号</th>
                <th className={TH}>景别</th>
                <th className={TH}>光影</th>
                <th className={TH}>运镜</th>
                <th className={TH}>画面描述（含起始→终止站位）</th>
                <th className={TH}>道具</th>
                <th className={TH}>对白</th>
                <th className={TH}>时长(秒)</th>
                {showTiming ? <th className={TH}>时段</th> : null}
                <th className={TH}>音效</th>
                <th className={TH}>口型/配音备注</th>
                <th className={`${TH} w-9 px-0`} aria-hidden />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <Fragment key={`${row.frameIndex}-${index}`}>
                <tr>
                  <td className={TD}>
                    <input
                      className={`${FIELD} px-2 py-2 text-center text-[15px] text-neutral-800`}
                      type="text"
                      inputMode="numeric"
                      value={row.frameIndex}
                      onChange={(e) =>
                        patchRow(index, {
                          frameIndex:
                            parseInt(e.target.value.replace(/\D/g, ""), 10) ||
                            1,
                        })
                      }
                    />
                  </td>
                  <td className={TD}>
                    <textarea
                      className={`${FIELD} px-3 py-2 text-[14px] leading-relaxed`}
                      rows={storyTableTextareaRows(row.shotSize, 2, 8)}
                      value={row.shotSize}
                      onChange={(e) =>
                        patchRow(index, { shotSize: e.target.value })
                      }
                    />
                  </td>
                  <td className={TD}>
                    <textarea
                      className={`${FIELD} px-3 py-2 text-[14px] leading-relaxed`}
                      rows={storyTableTextareaRows(row.lighting, 2, 8)}
                      value={row.lighting}
                      onChange={(e) =>
                        patchRow(index, { lighting: e.target.value })
                      }
                    />
                  </td>
                  <td className={TD}>
                    <textarea
                      className={`${FIELD} px-3 py-2 text-[14px] leading-relaxed`}
                      rows={storyTableTextareaRows(row.cameraMove, 2, 8)}
                      value={row.cameraMove}
                      onChange={(e) =>
                        patchRow(index, { cameraMove: e.target.value })
                      }
                    />
                  </td>
                  <td className={TD}>
                    <textarea
                      className={`${FIELD} px-3 py-2 text-[14px] leading-relaxed`}
                      rows={storyTableTextareaRows(row.description, 5, 18)}
                      value={row.description}
                      onChange={(e) =>
                        patchRow(index, { description: e.target.value })
                      }
                    />
                  </td>
                  <td className={TD}>
                    <textarea
                      className={`${FIELD} px-3 py-2 text-[14px] leading-relaxed`}
                      rows={storyTableTextareaRows(row.propNames, 2, 8)}
                      value={row.propNames}
                      onChange={(e) =>
                        patchRow(index, { propNames: e.target.value })
                      }
                    />
                  </td>
                  <td className={TD}>
                    <textarea
                      className={`${FIELD} px-3 py-2 text-[14px] leading-relaxed`}
                      rows={storyTableTextareaRows(row.dialogue, 3, 12)}
                      value={row.dialogue}
                      onChange={(e) =>
                        patchRow(index, { dialogue: e.target.value })
                      }
                    />
                  </td>
                  <td className={TD}>
                    <input
                      className={`${FIELD} px-2 py-2 text-center text-[14px]`}
                      type="text"
                      inputMode="numeric"
                      value={row.duration}
                      onChange={(e) =>
                        patchRow(index, { duration: e.target.value })
                      }
                    />
                  </td>
                  {showTiming ? (
                    <td className={TD}>
                      <p className="px-2 py-2 text-center text-[13px] text-neutral-500">
                        {formatPro2ShotTimingLabel(
                          shotAnalysisByIndex?.[row.frameIndex],
                        ) || "—"}
                      </p>
                    </td>
                  ) : null}
                  <td className={TD}>
                    <textarea
                      className={`${FIELD} px-3 py-2 text-[14px] leading-relaxed`}
                      rows={storyTableTextareaRows(row.sfxNote, 2, 8)}
                      value={row.sfxNote}
                      onChange={(e) =>
                        patchRow(index, { sfxNote: e.target.value })
                      }
                    />
                  </td>
                  <td className={TD}>
                    <textarea
                      className={`${FIELD} px-3 py-2 text-[14px] leading-relaxed`}
                      rows={storyTableTextareaRows(row.lipSyncNote, 2, 8)}
                      value={row.lipSyncNote}
                      onChange={(e) =>
                        patchRow(index, { lipSyncNote: e.target.value })
                      }
                    />
                  </td>
                  <td className={`${TD} w-9 text-center`}>
                    <button
                      type="button"
                      className="mx-auto flex size-8 items-center justify-center rounded text-neutral-400 hover:bg-red-50 hover:text-red-600"
                      aria-label={`删除镜 ${row.frameIndex}`}
                      onClick={() => removeRow(index)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
                {showTiming &&
                shotHasPro2Analysis(shotAnalysisByIndex?.[row.frameIndex]) ? (
                  <tr>
                    <td colSpan={v2ColSpan} className={`${TD} px-3 py-1.5`}>
                      <Pro2ShotAnalysisFold
                        analysis={shotAnalysisByIndex?.[row.frameIndex]}
                      />
                    </td>
                  </tr>
                ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="inline-flex w-fit items-center gap-1 text-[13px] font-medium text-neutral-600 hover:text-[#ea580c]"
          onClick={addRow}
        >
          <Plus className="size-4" />
          添加分镜
        </button>
      </div>
    );
  }

  return (
    <div className="nodrag flex min-h-0 w-full flex-1 flex-col gap-3">
      <p className="text-[12px] text-neutral-500">
        点击单元格编辑；表头与专业版制作包一致，保存不丢列。
      </p>
      <div className="overflow-x-auto overflow-y-visible">
        <table className={TABLE}>
          <colgroup>
            <col className="w-[64px]" />
            <col className="min-w-[72px]" />
            <col className="min-w-[72px]" />
            <col className="min-w-[220px]" />
            <col className="min-w-[140px]" />
            <col className="w-[64px]" />
            <col className="min-w-[180px]" />
            <col className="min-w-[180px]" />
            <col className="min-w-[120px]" />
            <col className="w-9" />
          </colgroup>
          <thead>
            <tr>
              <th className={TH}>镜号</th>
              <th className={TH}>景别</th>
              <th className={TH}>运镜</th>
              <th className={TH}>画面描述（含起始→终止站位）</th>
              <th className={TH}>对白</th>
              <th className={TH}>时长(秒)</th>
              <th className={TH}>{STORY_PRO2_UI_STORYBOARD_AI_IMAGE_LABEL}</th>
              <th className={TH}>{STORY_PRO2_UI_STORYBOARD_AI_VIDEO_LABEL}</th>
              <th className={TH}>口型/配音备注</th>
              <th className={`${TH} w-9 px-0`} aria-hidden />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.frameIndex}-${index}`}>
                <td className={TD}>
                  <input
                    className={`${FIELD} px-2 py-2 text-center text-[15px] text-neutral-800`}
                    type="text"
                    inputMode="numeric"
                    value={row.frameIndex}
                    onChange={(e) =>
                      patchRow(index, {
                        frameIndex:
                          parseInt(e.target.value.replace(/\D/g, ""), 10) || 1,
                      })
                    }
                  />
                </td>
                <td className={TD}>
                  <textarea
                    className={`${FIELD} px-3 py-2 text-[14px] leading-relaxed`}
                    rows={storyTableTextareaRows(row.shotSize, 2, 8)}
                    value={row.shotSize}
                    onChange={(e) =>
                      patchRow(index, { shotSize: e.target.value })
                    }
                  />
                </td>
                <td className={TD}>
                  <textarea
                    className={`${FIELD} px-3 py-2 text-[14px] leading-relaxed`}
                    rows={storyTableTextareaRows(row.cameraMove, 2, 8)}
                    value={row.cameraMove}
                    onChange={(e) =>
                      patchRow(index, { cameraMove: e.target.value })
                    }
                  />
                </td>
                <td className={TD}>
                  <textarea
                    className={`${FIELD} px-3 py-2 text-[14px] leading-relaxed`}
                    rows={storyTableTextareaRows(row.description, 5, 18)}
                    value={row.description}
                    onChange={(e) =>
                      patchRow(index, { description: e.target.value })
                    }
                  />
                </td>
                <td className={TD}>
                  <textarea
                    className={`${FIELD} px-3 py-2 text-[14px] leading-relaxed`}
                    rows={storyTableTextareaRows(row.dialogue, 3, 12)}
                    value={row.dialogue}
                    onChange={(e) =>
                      patchRow(index, { dialogue: e.target.value })
                    }
                  />
                </td>
                <td className={TD}>
                  <input
                    className={`${FIELD} px-2 py-2 text-center text-[14px]`}
                    type="text"
                    inputMode="numeric"
                    value={row.duration}
                    onChange={(e) =>
                      patchRow(index, { duration: e.target.value })
                    }
                  />
                </td>
                <td className={TD}>
                  <textarea
                    className={`${FIELD} px-3 py-2 text-[14px] leading-relaxed`}
                    rows={storyTableTextareaRows(row.aiImagePrompt, 2, 12)}
                    value={row.aiImagePrompt}
                    onChange={(e) =>
                      patchRow(index, { aiImagePrompt: e.target.value })
                    }
                  />
                </td>
                <td className={TD}>
                  <textarea
                    className={`${FIELD} px-3 py-2 text-[14px] leading-relaxed`}
                    rows={storyTableTextareaRows(row.aiVideoPrompt, 2, 12)}
                    value={row.aiVideoPrompt}
                    onChange={(e) =>
                      patchRow(index, {
                        aiVideoPrompt: e.target.value,
                        videoPrompt: e.target.value,
                      })
                    }
                  />
                </td>
                <td className={TD}>
                  <textarea
                    className={`${FIELD} px-3 py-2 text-[14px] leading-relaxed`}
                    rows={storyTableTextareaRows(row.lipSyncNote, 2, 8)}
                    value={row.lipSyncNote}
                    onChange={(e) =>
                      patchRow(index, { lipSyncNote: e.target.value })
                    }
                  />
                </td>
                <td className={`${TD} w-9 text-center`}>
                  <button
                    type="button"
                    className="mx-auto flex size-8 items-center justify-center rounded text-neutral-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={`删除镜 ${row.frameIndex}`}
                    onClick={() => removeRow(index)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="inline-flex w-fit items-center gap-1 text-[13px] font-medium text-neutral-600 hover:text-[#ea580c]"
        onClick={addRow}
      >
        <Plus className="size-4" />
        添加分镜
      </button>
    </div>
  );
}
