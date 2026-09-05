"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** 模式 A · 数据表外壳（见 design/TABLE.md） */
export const ecomDataTableWrapClass = "overflow-x-auto rounded-lg border border-[#e8e8ed]";

/** 模式 A · 表格本体 */
export const ecomDataTableClass = "w-full border-collapse text-left text-xs";

/** 模式 A · 墨黑表头行 */
export const ecomDataTableHeadRowClass = "bg-[#1d1d1f] text-white";

/** 模式 A · 表体行 */
export const ecomDataTableBodyRowClass = "border-t border-[#e8e8ed] align-top";

export const ecomDataTableThClass = "px-3 py-2 font-medium";

export const ecomDataTableTdClass = "px-3 py-2 align-top text-[#1d1d1f]";

export type EcomDataTableProps = {
  headers: ReactNode[];
  rows: ReactNode[][];
  minWidth?: number | string;
  emptyPlaceholder?: string;
  /** 首列加粗（键值表如「项目 | 已选配置」） */
  labelColumn?: boolean;
  className?: string;
  tableClassName?: string;
};

function renderCell(cell: ReactNode, emptyPlaceholder: string): ReactNode {
  if (cell === null || cell === undefined || cell === "") return emptyPlaceholder;
  return cell;
}

/** 电商工具箱 · 模式 A 数据表（深色表头） */
export function EcomDataTable({
  headers,
  rows,
  minWidth = 480,
  emptyPlaceholder = "—",
  labelColumn = false,
  className,
  tableClassName,
}: EcomDataTableProps) {
  const minW = typeof minWidth === "number" ? `${minWidth}px` : minWidth;

  return (
    <div className={cn(ecomDataTableWrapClass, className)}>
      <table className={cn(ecomDataTableClass, tableClassName)} style={{ minWidth: minW }}>
        <thead>
          <tr className={ecomDataTableHeadRowClass}>
            {headers.map((header, index) => (
              <th key={index} className={ecomDataTableThClass}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className={ecomDataTableBodyRowClass}>
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={cn(ecomDataTableTdClass, labelColumn && cellIndex === 0 && "font-medium")}
                >
                  {renderCell(cell, emptyPlaceholder)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
