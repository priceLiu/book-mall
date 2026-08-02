"use client";

import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";

import {
  formatSceneDictionaryTableMarkdown,
  parseSceneVisualDictionaryRows,
  type SceneVisualDictionaryRow,
} from "@/lib/canvas/parse-md-tables";
import {
  storyMdTableWrapperClass,
  storyMdTdClass,
  storyMdThClass,
} from "@/lib/canvas/story-md-table-chrome";
import { storyTableTextareaRows } from "@/lib/canvas/story-table-textarea-rows";
import { STORY_PRO2_UI_SCENE_IMAGE_KEYWORDS_LABEL } from "@/lib/canvas/data/pro2-production-pack-standard";

export function sceneRowsFromMd(md: string): SceneVisualDictionaryRow[] {
  return parseSceneVisualDictionaryRows(md);
}

export function canEditSceneDictionaryAsTable(md: string): boolean {
  const t = md.trim();
  if (!t) return true;
  return sceneRowsFromMd(md).length > 0;
}

const FIELD =
  "block w-full min-h-[2.75rem] resize-y border-0 bg-transparent outline-none ring-0 whitespace-pre-wrap break-words placeholder:text-neutral-400 focus:bg-amber-50/50";

/** 场景视觉辞典 4 列编辑表 */
export function StorySceneDictionaryTableEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (md: string) => void;
}) {
  const rows = useMemo(() => sceneRowsFromMd(value), [value]);
  const TABLE = storyMdTableWrapperClass("editor");
  const TH = storyMdThClass("editor");
  const TD = `${storyMdTdClass("editor")} p-0 align-top`;

  const commit = (next: SceneVisualDictionaryRow[]) => {
    onChange(formatSceneDictionaryTableMarkdown(next.filter((r) => r.name.trim())));
  };

  const envDisplay = (row: SceneVisualDictionaryRow) =>
    row.envTimeMood?.trim() ||
    [row.environment, row.time, row.mood].filter(Boolean).join(" · ");

  const patchRow = (index: number, patch: Partial<SceneVisualDictionaryRow>) => {
    commit(
      rows.map((r, i) => {
        if (i !== index) return r;
        const merged = { ...r, ...patch };
        if (patch.envTimeMood !== undefined) {
          merged.environment = patch.envTimeMood;
          merged.time = "";
          merged.mood = "";
        }
        return merged;
      }),
    );
  };

  const addRow = () => {
    commit([
      ...rows,
      {
        name: "",
        environment: "",
        time: "",
        mood: "",
        imageKeywords: "",
        negativePrompt: "",
      },
    ]);
  };

  const removeRow = (index: number) => {
    commit(rows.filter((_, i) => i !== index));
  };

  return (
    <div className="nodrag flex min-h-0 w-full flex-1 flex-col gap-3">
      <p className="text-[12px] text-neutral-500">
        场景视觉辞典 · 4 列与制作包一致；保存不丢列。
      </p>
      <div className="overflow-x-auto overflow-y-visible">
        <table className={TABLE}>
          <colgroup>
            <col className="min-w-[100px]" />
            <col className="min-w-[220px]" />
            <col className="min-w-[200px]" />
            <col className="min-w-[160px]" />
            <col className="w-9" />
          </colgroup>
          <thead>
            <tr>
              <th className={TH}>场景名</th>
              <th className={TH}>环境/时间/气氛</th>
              <th className={TH}>{STORY_PRO2_UI_SCENE_IMAGE_KEYWORDS_LABEL}</th>
              <th className={TH}>固定反向提示词</th>
              <th className={`${TH} w-9 px-0`} aria-hidden />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.name}-${index}`}>
                <td className={TD}>
                  <input
                    className={`${FIELD} px-3 py-2 text-[14px]`}
                    value={row.name}
                    placeholder="场景名·日/夜"
                    onChange={(e) => patchRow(index, { name: e.target.value })}
                  />
                </td>
                <td className={TD}>
                  <textarea
                    className={`${FIELD} px-3 py-2 text-[14px] leading-relaxed`}
                    rows={storyTableTextareaRows(envDisplay(row), 3, 14)}
                    value={envDisplay(row)}
                    onChange={(e) =>
                      patchRow(index, { envTimeMood: e.target.value })
                    }
                  />
                </td>
                <td className={TD}>
                  <textarea
                    className={`${FIELD} px-3 py-2 text-[14px] leading-relaxed`}
                    rows={storyTableTextareaRows(row.imageKeywords, 3, 14)}
                    value={row.imageKeywords}
                    onChange={(e) =>
                      patchRow(index, { imageKeywords: e.target.value })
                    }
                  />
                </td>
                <td className={TD}>
                  <textarea
                    className={`${FIELD} px-3 py-2 text-[14px] leading-relaxed`}
                    rows={storyTableTextareaRows(row.negativePrompt ?? "", 2, 10)}
                    value={row.negativePrompt ?? ""}
                    onChange={(e) =>
                      patchRow(index, { negativePrompt: e.target.value })
                    }
                  />
                </td>
                <td className={`${TD} w-9 text-center`}>
                  <button
                    type="button"
                    className="mx-auto flex size-8 items-center justify-center rounded text-neutral-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={`删除场景 ${row.name || index + 1}`}
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
        添加场景
      </button>
    </div>
  );
}
