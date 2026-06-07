"use client";

/** 轻量 Markdown 展示（表格/标题/段落） */
export function StoryboardMarkdownBlock({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  const elements: React.ReactNode[] = [];
  let tableRows: string[][] = [];
  let key = 0;

  function stripCellBold(text: string): string {
    const t = text.trim();
    if (t.startsWith("**") && t.endsWith("**")) return t.slice(2, -2).trim();
    return t;
  }

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

    const colCount = Math.max(...dataRows.map((r) => r.length), 1);
    const padRow = (row: string[]) => {
      const cells = [...row];
      while (cells.length < colCount) cells.push("");
      return cells.map((c) => stripCellBold(c));
    };

    let titleRow: string | null = null;
    let head: string[] | null = null;
    let body: string[][] = [];

    let start = 0;
    if (dataRows[0]?.length === 1 && dataRows[0][0]?.trim()) {
      titleRow = stripCellBold(dataRows[0][0]!);
      start = 1;
    }

    const rest = dataRows.slice(start).map(padRow);
    if (rest.length > 0) {
      head = rest[0]!;
      body = rest.slice(1);
    }

    elements.push(
      <div key={key++} className="my-3">
        {titleRow ? (
          <p className="mb-2 text-sm font-semibold text-[#1d1d1f]">{titleRow}</p>
        ) : null}
        <div className="overflow-x-auto rounded-lg border border-[#e8e8ed]">
          <table className="w-full min-w-[480px] table-fixed border-collapse text-left text-xs">
            <colgroup>
              {Array.from({ length: colCount }, (_, i) => (
                <col key={i} style={{ width: `${100 / colCount}%` }} />
              ))}
            </colgroup>
            {head ? (
              <thead>
                <tr className="bg-[#1d1d1f] text-white">
                  {head.map((c, i) => (
                    <th key={i} className="px-3 py-2 font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
            ) : null}
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri} className="border-t border-[#e8e8ed]">
                  {row.map((c, ci) => (
                    <td key={ci} className="px-3 py-2 align-top text-[#1d1d1f]">
                      {c}
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
    const t = line.trim();
    if (t.startsWith("|") && t.endsWith("|")) {
      tableRows.push(
        t
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim()),
      );
      continue;
    }
    flushTable();
    if (!t) {
      elements.push(<div key={key++} className="h-2" />);
      continue;
    }
    if (t.startsWith("### ")) {
      elements.push(
        <h4 key={key++} className="mt-4 text-sm font-semibold text-[#1d1d1f]">
          {t.slice(4)}
        </h4>,
      );
    } else if (t.startsWith("## ")) {
      elements.push(
        <h3 key={key++} className="mt-4 text-base font-semibold text-[#1d1d1f]">
          {t.slice(3)}
        </h3>,
      );
    } else if (t.startsWith("# ")) {
      elements.push(
        <h2 key={key++} className="text-lg font-semibold text-[#1d1d1f]">
          {t.slice(2)}
        </h2>,
      );
    } else if (t.startsWith("**") && t.endsWith("**")) {
      elements.push(
        <p key={key++} className="text-sm font-medium text-[#1d1d1f]">
          {t.slice(2, -2)}
        </p>,
      );
    } else {
      elements.push(
        <p key={key++} className="text-sm leading-relaxed text-[#424245]">
          {t}
        </p>,
      );
    }
  }
  flushTable();

  return <div className="space-y-1">{elements}</div>;
}
