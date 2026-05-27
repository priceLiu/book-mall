"use client";

import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";

import {
  formatGenericGfmTableMarkdown,
  parseMdTableDisplay,
  type MdTableRow,
} from "@/lib/canvas/parse-md-tables";
import {
  storyMdTableWrapperClass,
  storyMdTdClass,
  storyMdThClass,
} from "@/lib/canvas/story-md-table-chrome";
import { storyTableTextareaRows } from "@/lib/canvas/story-table-textarea-rows";

const TABLE = storyMdTableWrapperClass("editor");
const TH = storyMdThClass("editor");
const TD = `${storyMdTdClass("editor")} p-0 align-top`;
const FIELD =
  "block w-full min-h-[2.75rem] resize-y border-0 bg-transparent outline-none ring-0 whitespace-pre-wrap break-words placeholder:text-neutral-400 focus:bg-amber-50/50";

export function canEditGenericMdTable(md: string): boolean {
  const { headers } = parseMdTableDisplay(md);
  return headers.length > 0;
}

export function StoryGenericMdTableEditor({
  value,
  onChange,
  readOnly = false,
}: {
  value: string;
  onChange: (md: string) => void;
  readOnly?: boolean;
}) {
  const { headers, rows } = useMemo(() => parseMdTableDisplay(value), [value]);

  const commit = (nextHeaders: string[], nextRows: MdTableRow[]) => {
    onChange(formatGenericGfmTableMarkdown(nextHeaders, nextRows));
  };

  const patchCell = (rowIndex: number, header: string, cell: string) => {
    commit(
      headers,
      rows.map((row, i) =>
        i === rowIndex ? { ...row, [header]: cell } : row,
      ),
    );
  };

  const addRow = () => {
    const blank: MdTableRow = {};
    for (const h of headers) blank[h] = "";
    commit(headers, [...rows, blank]);
  };

  const removeRow = (rowIndex: number) => {
    commit(
      headers,
      rows.filter((_, i) => i !== rowIndex),
    );
  };

  if (!headers.length) return null;

  return (
    <div className="nodrag overflow-x-auto overflow-y-visible">
      <table className={TABLE}>
        <colgroup>
          {headers.map((h) => (
            <col key={h} className="min-w-[120px]" />
          ))}
          {!readOnly ? <col className="w-9" /> : null}
        </colgroup>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} className={TH}>
                {h}
              </th>
            ))}
            {!readOnly ? (
              <th className={`${TH} w-9 px-0`} aria-hidden />
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`}>
              {headers.map((h) => {
                const cell = row[h] ?? "";
                const isShort = cell.length < 48 && !cell.includes("\n");
                return (
                  <td key={`${rowIndex}-${h}`} className={TD}>
                    {readOnly ? (
                      <span className="block px-4 py-2.5 text-[15px] leading-relaxed text-neutral-800">
                        {cell || "—"}
                      </span>
                    ) : isShort ? (
                      <input
                        className={`${FIELD} px-4 py-2.5 text-[15px] leading-relaxed text-neutral-800`}
                        value={cell}
                        onChange={(e) =>
                          patchCell(rowIndex, h, e.target.value)
                        }
                      />
                    ) : (
                      <textarea
                        className={`${FIELD} px-4 py-2.5 text-[15px] leading-relaxed text-neutral-800`}
                        rows={storyTableTextareaRows(cell, 2, 16)}
                        value={cell}
                        onChange={(e) =>
                          patchCell(rowIndex, h, e.target.value)
                        }
                      />
                    )}
                  </td>
                );
              })}
              {!readOnly ? (
                <td className={`${TD} w-9 text-center`}>
                  <button
                    type="button"
                    className="mx-auto flex size-8 items-center justify-center rounded text-neutral-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={`删除第 ${rowIndex + 1} 行`}
                    onClick={() => removeRow(rowIndex)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly ? (
        <button
          type="button"
          className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-neutral-600 hover:text-[#ea580c]"
          onClick={addRow}
        >
          <Plus className="size-4" />
          添加行
        </button>
      ) : null}
    </div>
  );
}
