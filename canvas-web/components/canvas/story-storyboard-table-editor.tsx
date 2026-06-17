"use client";

import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";

import {
  formatStoryboardTableMarkdown,
  isProStoryboardTableMd,
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

/** 专业版 8 列分镜编辑表（与 story-pro-script-pack 表头一致） */
export function StoryStoryboardTableEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (md: string) => void;
}) {
  const rows = useMemo(() => storyboardRowsFromMd(value), [value]);
  const useProFormat = useMemo(
    () => isProStoryboardTableMd(value) || rows.length > 0,
    [value, rows.length],
  );
  const variant = "editor" as const;
  const TABLE = storyMdTableWrapperClass(variant);
  const TH = storyMdThClass(variant);
  const TD = `${storyMdTdClass(variant)} p-0`;

  const commit = (next: StoryboardTableRow[]) => {
    onChange(
      formatStoryboardTableMarkdown(next, {
        format: useProFormat ? "pro" : "legacy",
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
      {
        frameIndex: nextIndex,
        scene: "",
        shotSize: "",
        cameraMove: "",
        description: "",
        dialogue: "—",
        duration: "",
        aiVideoPrompt: "",
        lipSyncNote: "",
        videoPrompt: "",
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

  return (
    <div className="nodrag flex min-h-0 w-full flex-1 flex-col gap-3">
      <p className="text-[12px] text-neutral-500">
        点击单元格编辑；表头与专业版制作包一致，保存不丢列。
      </p>
      <div className="overflow-x-auto overflow-y-visible">
        <table className={TABLE}>
          <colgroup>
            <col className="w-[52px]" />
            <col className="min-w-[72px]" />
            <col className="min-w-[72px]" />
            <col className="min-w-[220px]" />
            <col className="min-w-[140px]" />
            <col className="w-[64px]" />
            <col className="min-w-[180px]" />
            <col className="min-w-[120px]" />
            <col className="w-9" />
          </colgroup>
          <thead>
            <tr>
              <th className={TH}>镜号</th>
              <th className={TH}>景别</th>
              <th className={TH}>运镜</th>
              <th className={TH}>画面描述</th>
              <th className={TH}>对白</th>
              <th className={TH}>时长(秒)</th>
              <th className={TH}>AI视频提示词</th>
              <th className={TH}>口型/配音</th>
              <th className={`${TH} w-9 px-0`} aria-hidden />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.frameIndex}-${index}`}>
                <td className={TD}>
                  <input
                    className={`${FIELD} px-2 py-2 text-center text-[15px] text-neutral-800`}
                    type="number"
                    min={1}
                    value={row.frameIndex}
                    onChange={(e) =>
                      patchRow(index, {
                        frameIndex: parseInt(e.target.value, 10) || 1,
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
