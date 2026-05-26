"use client";

import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";

import {
  formatStoryboardTableMarkdown,
  parseStoryboardRows,
} from "@/lib/canvas/parse-md-tables";
import {
  storyMdTableWrapperClass,
  storyMdTdClass,
  storyMdThClass,
} from "@/lib/canvas/story-md-table-chrome";
import { storyTableTextareaRows } from "@/lib/canvas/story-table-textarea-rows";

export type StoryboardTableRow = {
  frameIndex: number;
  scene: string;
  description: string;
  dialogue: string;
  videoPrompt: string;
};

export function storyboardRowsFromMd(md: string): StoryboardTableRow[] {
  return parseStoryboardRows(md).map((r) => ({
    frameIndex: r.frameIndex,
    scene: r.scene,
    description: r.description,
    dialogue: r.dialogue,
    videoPrompt: r.videoPrompt,
  }));
}

export function canEditStoryboardAsTable(md: string): boolean {
  const t = md.trim();
  if (!t) return true;
  return storyboardRowsFromMd(md).length > 0;
}

const FIELD =
  "block w-full min-h-[2.75rem] resize-y border-0 bg-transparent outline-none ring-0 whitespace-pre-wrap break-words placeholder:text-neutral-400 focus:bg-amber-50/50";

/** 与角色设定表同款的 GFM 分镜编辑表 */
export function StoryStoryboardTableEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (md: string) => void;
}) {
  const rows = useMemo(() => storyboardRowsFromMd(value), [value]);
  const variant = "editor" as const;
  const TABLE = storyMdTableWrapperClass(variant);
  const TH = storyMdThClass(variant);
  const TD = `${storyMdTdClass(variant)} p-0`;

  const commit = (next: StoryboardTableRow[]) => {
    onChange(formatStoryboardTableMarkdown(next));
  };

  const patchRow = (index: number, patch: Partial<StoryboardTableRow>) => {
    commit(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    const nextIndex =
      rows.length > 0 ? Math.max(...rows.map((r) => r.frameIndex)) + 1 : 1;
    commit([
      ...rows,
      {
        frameIndex: nextIndex,
        scene: "",
        description: "",
        dialogue: "—",
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
        点击单元格编辑，版式与右侧原稿一致；可拖曳右下角调整单元格高度。
      </p>
      <div className="overflow-x-auto overflow-y-visible">
        <table className={TABLE}>
          <colgroup>
            <col className="w-[56px]" />
            <col className="min-w-[120px]" />
            <col className="min-w-[280px]" />
            <col className="min-w-[160px]" />
            <col className="min-w-[140px]" />
            <col className="w-9" />
          </colgroup>
          <thead>
            <tr>
              <th className={TH}>镜号</th>
              <th className={TH}>场景</th>
              <th className={TH}>画面描述</th>
              <th className={TH}>台词</th>
              <th className={TH}>视频提示</th>
              <th className={`${TH} w-9 px-0`} aria-hidden />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.frameIndex}-${index}`}>
                <td className={TD}>
                  <input
                    className={`${FIELD} px-3 py-2 text-center text-[15px]`}
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
                    className={`${FIELD} px-4 py-2.5 text-[15px] leading-relaxed`}
                    rows={storyTableTextareaRows(row.scene, 2, 10)}
                    value={row.scene}
                    onChange={(e) => patchRow(index, { scene: e.target.value })}
                  />
                </td>
                <td className={TD}>
                  <textarea
                    className={`${FIELD} px-4 py-2.5 text-[15px] leading-relaxed`}
                    rows={storyTableTextareaRows(row.description, 5, 18)}
                    value={row.description}
                    onChange={(e) =>
                      patchRow(index, { description: e.target.value })
                    }
                  />
                </td>
                <td className={TD}>
                  <textarea
                    className={`${FIELD} px-4 py-2.5 text-[15px] leading-relaxed`}
                    rows={storyTableTextareaRows(row.dialogue, 3, 12)}
                    value={row.dialogue}
                    onChange={(e) =>
                      patchRow(index, { dialogue: e.target.value })
                    }
                  />
                </td>
                <td className={TD}>
                  <textarea
                    className={`${FIELD} px-4 py-2.5 text-[15px] leading-relaxed`}
                    rows={storyTableTextareaRows(row.videoPrompt, 2, 10)}
                    value={row.videoPrompt}
                    onChange={(e) =>
                      patchRow(index, { videoPrompt: e.target.value })
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
