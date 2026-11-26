"use client";

/** 分镜解析字段 · 完整展示（§十要求完整通顺中文句，禁止表格内截断省略） */
function AnalysisCell({ text }: { text: string }) {
  const value = text.trim() || "—";
  return (
    <span className="block min-w-[9rem] max-w-[20rem] whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--ecom-ink)]">
      {value}
    </span>
  );
}

export { AnalysisCell };
