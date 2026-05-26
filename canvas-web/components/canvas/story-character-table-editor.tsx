"use client";

import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";

import {
  formatCharacterTableMarkdown,
  parseCharacterRows,
} from "@/lib/canvas/parse-md-tables";

export type CharacterTableRow = {
  name: string;
  role: string;
  appearance: string;
};

export function characterRowsFromMd(md: string): CharacterTableRow[] {
  return parseCharacterRows(md).map((r) => ({
    name: r.name,
    role: r.role,
    appearance: r.appearance,
  }));
}

/** 能否用表格编辑（已成功解析出至少一行，或尚无内容） */
export function canEditCharacterAsTable(md: string): boolean {
  const t = md.trim();
  if (!t) return true;
  return characterRowsFromMd(md).length > 0;
}

function textareaRows(text: string, min: number, charsPerLine: number): number {
  const lines = text.split("\n").length;
  const wrapped = Math.ceil(text.length / charsPerLine);
  return Math.max(min, lines, wrapped);
}

/** 与右侧原稿 GFM 表格同款的编辑表 */
const TABLE =
  "w-full table-fixed border-collapse border border-neutral-300 text-left text-[15px] leading-relaxed";
const TH =
  "border border-neutral-300 bg-neutral-100 px-4 py-2.5 font-semibold text-neutral-900";
const TD = "border border-neutral-200 bg-white p-0 align-top";
const FIELD =
  "block w-full resize-none border-0 bg-transparent px-4 py-2.5 text-[15px] leading-relaxed text-neutral-800 outline-none ring-0 placeholder:text-neutral-400 focus:bg-amber-50/50";

export function StoryCharacterTableEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (md: string) => void;
}) {
  const rows = useMemo(() => characterRowsFromMd(value), [value]);

  const commit = (next: CharacterTableRow[]) => {
    onChange(formatCharacterTableMarkdown(next.filter((r) => r.name.trim())));
  };

  const patchRow = (index: number, patch: Partial<CharacterTableRow>) => {
    commit(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    commit([
      ...rows,
      { name: "", role: "", appearance: "（待补充外观）" },
    ]);
  };

  const removeRow = (index: number) => {
    commit(rows.filter((_, i) => i !== index));
  };

  return (
    <div className="nodrag flex min-h-0 w-full flex-1 flex-col gap-3">
      <p className="text-[12px] text-neutral-500">
        点击单元格编辑，版式与右侧原稿一致；保存后同步。
      </p>
      <div className="overflow-x-auto">
        <table className={TABLE}>
          <colgroup>
            <col className="w-[96px]" />
            <col className="w-[32%]" />
            <col />
            <col className="w-9" />
          </colgroup>
          <thead>
            <tr>
              <th className={TH}>角色</th>
              <th className={TH}>定位</th>
              <th className={TH}>外观描述</th>
              <th className={`${TH} w-9 px-0`} aria-hidden />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.name}-${index}`}>
                <td className={TD}>
                  <input
                    className={FIELD}
                    value={row.name}
                    placeholder="角色名"
                    onChange={(e) => patchRow(index, { name: e.target.value })}
                  />
                </td>
                <td className={TD}>
                  <textarea
                    className={FIELD}
                    rows={textareaRows(row.role, 2, 22)}
                    value={row.role}
                    placeholder="身份、立场、与主线关系"
                    onChange={(e) => patchRow(index, { role: e.target.value })}
                  />
                </td>
                <td className={TD}>
                  <textarea
                    className={FIELD}
                    rows={textareaRows(row.appearance, 3, 28)}
                    value={row.appearance}
                    placeholder="画像用外观描述"
                    onChange={(e) =>
                      patchRow(index, { appearance: e.target.value })
                    }
                  />
                </td>
                <td className={`${TD} w-9 text-center`}>
                  <button
                    type="button"
                    className="mx-auto flex size-8 items-center justify-center rounded text-neutral-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={`删除角色 ${row.name || index + 1}`}
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
        添加角色
      </button>
    </div>
  );
}
