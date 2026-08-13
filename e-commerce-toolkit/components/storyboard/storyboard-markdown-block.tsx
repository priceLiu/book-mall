"use client";

import type React from "react";

function decodeInlineHtml(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/** 行内 **粗体** 与换行 */
function renderInlineText(text: string, keyPrefix: string): React.ReactNode {
  const normalized = decodeInlineHtml(text);
  if (!normalized.includes("**")) {
    return normalized.split("\n").map((line, i, arr) => (
      <span key={`${keyPrefix}-${i}`}>
        {line}
        {i < arr.length - 1 ? <br /> : null}
      </span>
    ));
  }
  const parts = normalized.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${keyPrefix}-b-${i}`} className="font-semibold text-[#1d1d1f]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part.split("\n").map((line, j, arr) => (
      <span key={`${keyPrefix}-${i}-${j}`}>
        {line}
        {j < arr.length - 1 ? <br /> : null}
      </span>
    ));
  });
}

function stripCellMd(text: string): string {
  return decodeInlineHtml(text.replace(/\*\*/g, "").trim());
}

/** 识别「编号 | 方案名称 | …」类表头行（勿把方案数据行当作 thead） */
function looksLikeTableHeaderRow(row: string[]): boolean {
  const cells = row.map(stripCellMd).filter(Boolean);
  if (cells.length < 2) return false;
  const joined = cells.join(" ");
  if (/编号|序号|方案编号/.test(joined) && /方案名称|名称/.test(joined)) return true;
  if (/方案名称/.test(joined) && /切入|痛点|收获|情绪|逻辑|维度/.test(joined)) return true;
  if (/^维度$/i.test(cells[0] ?? "") && cells.slice(1).some((c) => /方案\s*[ABC123]/i.test(c))) {
    return true;
  }
  const first = cells[0] ?? "";
  if (/^[123]$/.test(first)) return false;
  if (cells.some((c) => c.length > 36)) return false;
  return cells.every((c) => c.length > 0 && c.length <= 28);
}

/** 识别 Step2 总表的数据行（首列为 1/2/3 或缺编号/名称但后续列有长文案） */
function looksLikePlanDataRow(row: string[]): boolean {
  const cells = row.map(stripCellMd);
  const first = cells[0] ?? "";
  if (/^[123]$/.test(first)) return true;
  const second = cells[1] ?? "";
  if (!first && second.length > 1 && !/方案名称|编号/.test(second)) return true;
  if (!first && !second && cells.slice(2).some((c) => c.length > 10)) return true;
  return false;
}

function normalizeMarkdownTableLine(line: string): string {
  return line.replace(/\uFF5C/g, "|").trim();
}

function parseMarkdownTableRow(line: string): string[] | null {
  const t = normalizeMarkdownTableLine(line);
  if (t.startsWith("|") && t.endsWith("|")) {
    return t
      .slice(1, -1)
      .split("|")
      .map((c) => c.trim());
  }
  if (t.includes("|") && !t.startsWith("#")) {
    const cells = t.split("|").map((c) => c.trim()).filter((c, i, arr) => {
      // 保留中间空单元格；去掉 split 产生的首尾空串
      if (i === 0 && c === "" && !t.startsWith("|")) return false;
      if (i === arr.length - 1 && c === "" && !t.endsWith("|")) return false;
      return true;
    });
    if (cells.length >= 3 && cells.every((c) => c.length <= 120)) return cells;
  }
  return null;
}

/** 整行被包成单单元格时（如段落里的「| 编号 | 方案名称 | …」）再拆一次 */
function expandSingleCellTableRow(row: string[]): string[] | null {
  if (row.length !== 1) return null;
  const inner = normalizeMarkdownTableLine(row[0] ?? "");
  if (!inner.includes("|")) return null;
  const wrapped = inner.startsWith("|") ? inner : `|${inner}|`;
  const reparsed = parseMarkdownTableRow(wrapped);
  return reparsed && reparsed.length >= 3 ? reparsed : null;
}

/** 轻量 Markdown 展示（表格/标题/段落，支持 <br> 与行内粗体） */
export function StoryboardMarkdownBlock({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  const elements: React.ReactNode[] = [];
  let tableRows: string[][] = [];
  let pendingHeaderRow: string[] | null = null;
  let key = 0;

  function isSeparatorRow(row: string[]): boolean {
    return row.every((c) => /^:?-+:?$/.test(c.trim()));
  }

  function flushTable() {
    if (tableRows.length === 0) return;

    const dataRows = tableRows.filter((row) => !isSeparatorRow(row));
    if (dataRows.length === 0) {
      tableRows = [];
      return;
    }

    for (let i = 0; i < dataRows.length; i++) {
      const expanded = expandSingleCellTableRow(dataRows[i]!);
      if (expanded) dataRows[i] = expanded;
    }

    const colCount = Math.max(...dataRows.map((r) => r.length), 1);
    const padRow = (row: string[]) => {
      const cells = [...row];
      while (cells.length < colCount) cells.push("");
      return cells;
    };

    let titleRow: string | null = null;
    let head: string[] | null = null;
    let body: string[][] = [];

    let start = 0;
    if (dataRows[0]?.length === 1 && dataRows[0][0]?.trim()) {
      const expanded = expandSingleCellTableRow(dataRows[0]!);
      if (!expanded) {
        titleRow = stripCellMd(dataRows[0][0]!);
        start = 1;
      }
    }

    const rest = dataRows.slice(start).map(padRow);
    if (rest.length === 0) {
      tableRows = [];
      return;
    }

    if (looksLikeTableHeaderRow(rest[0]!)) {
      head = rest[0]!;
      body = rest.slice(1);
      if (body.length === 0) {
        pendingHeaderRow = head;
        tableRows = [];
        return;
      }
      pendingHeaderRow = null;
    } else if (looksLikePlanDataRow(rest[0]!) || pendingHeaderRow) {
      head = pendingHeaderRow;
      pendingHeaderRow = null;
      body = rest;
    } else {
      head = rest[0]!;
      body = rest.slice(1);
    }

    const displayColCount = Math.max(colCount, head?.length ?? 0, ...body.map((r) => r.length));

    elements.push(
      <div key={key++} className="my-3">
        {titleRow ? (
          <p className="mb-2 text-sm font-semibold text-[#1d1d1f]">{titleRow}</p>
        ) : null}
        <div className="overflow-x-auto rounded-lg border border-[#e8e8ed]">
          <table className="w-full min-w-[480px] table-fixed border-collapse text-left text-xs">
            <colgroup>
              {Array.from({ length: displayColCount }, (_, i) => (
                <col key={i} style={{ width: `${100 / displayColCount}%` }} />
              ))}
            </colgroup>
            {head ? (
              <thead>
                <tr className="bg-[#1d1d1f] text-white">
                  {head.map((c, i) => (
                    <th key={i} className="px-3 py-2 font-medium">
                      {renderInlineText(c, `th-${key}-${i}`)}
                    </th>
                  ))}
                </tr>
              </thead>
            ) : null}
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri} className="border-t border-[#e8e8ed]">
                  {padRow(row).map((c, ci) => (
                    <td key={ci} className="px-3 py-2 align-top text-[#1d1d1f]">
                      {renderInlineText(c, `td-${key}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>,
    );
    tableRows = [];
  }

  for (const line of lines) {
    const parsedRow = parseMarkdownTableRow(line);
    if (parsedRow) {
      tableRows.push(parsedRow);
      continue;
    }
    flushTable();
    const t = normalizeMarkdownTableLine(line);
    if (!t) {
      elements.push(<div key={key++} className="h-2" />);
      continue;
    }
    const recoveredRow = parseMarkdownTableRow(t);
    if (
      recoveredRow &&
      (looksLikeTableHeaderRow(recoveredRow) || looksLikePlanDataRow(recoveredRow))
    ) {
      tableRows.push(recoveredRow);
      continue;
    }
    if (t.startsWith("#### ")) {
      elements.push(
        <h5 key={key++} className="mt-3 text-sm font-semibold text-[#1d1d1f]">
          {renderInlineText(t.slice(5), `h5-${key}`)}
        </h5>,
      );
    } else if (t.startsWith("### ")) {
      elements.push(
        <h4 key={key++} className="mt-4 text-sm font-semibold text-[#1d1d1f]">
          {renderInlineText(t.slice(4), `h4-${key}`)}
        </h4>,
      );
    } else if (t.startsWith("## ")) {
      elements.push(
        <h3 key={key++} className="mt-4 text-base font-semibold text-[#1d1d1f]">
          {renderInlineText(t.slice(3), `h3-${key}`)}
        </h3>,
      );
    } else if (t.startsWith("# ")) {
      elements.push(
        <h2 key={key++} className="text-lg font-semibold text-[#1d1d1f]">
          {renderInlineText(t.slice(2), `h2-${key}`)}
        </h2>,
      );
    } else if (t.startsWith("- ") || t.startsWith("* ")) {
      elements.push(
        <p key={key++} className="text-sm leading-relaxed text-[#424245]">
          <span className="mr-1 text-[#86868b]">·</span>
          {renderInlineText(t.slice(2), `li-${key}`)}
        </p>,
      );
    } else if (/^\|?\s*编号\s*\|/.test(t) && /方案名称/.test(t)) {
      const fallback = t
        .split("|")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
      if (fallback.length >= 3) {
        tableRows.push(fallback);
        continue;
      }
      elements.push(
        <p key={key++} className="text-sm leading-relaxed text-[#424245]">
          {renderInlineText(t, `p-${key}`)}
        </p>,
      );
    } else {
      elements.push(
        <p key={key++} className="text-sm leading-relaxed text-[#424245]">
          {renderInlineText(t, `p-${key}`)}
        </p>,
      );
    }
  }
  flushTable();

  return <div className="space-y-1">{elements}</div>;
}
