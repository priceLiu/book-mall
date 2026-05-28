"use client";

import { useMemo } from "react";

import { splitMarkdownByGfmTables } from "@/lib/canvas/parse-md-tables";
import { MarkdownView } from "./markdown-view";
import {
  canEditGenericMdTable,
  StoryGenericMdTableEditor,
} from "./story-generic-md-table-editor";

/** 定稿后只读：GFM 表 → 表格排版，其余 → Markdown 渲染（勿用 textarea 展示源码） */
export function StoryHubReadonlyPane({ md }: { md: string }) {
  const blocks = useMemo(() => splitMarkdownByGfmTables(md), [md]);

  if (!md.trim()) return null;

  return (
    <div className="nodrag flex min-h-0 w-full flex-1 flex-col gap-6">
      {blocks.map((block, index) =>
        block.kind === "table" && canEditGenericMdTable(block.value) ? (
          <StoryGenericMdTableEditor
            key={`ro-table-${index}`}
            value={block.value}
            readOnly
            onChange={() => {}}
          />
        ) : (
          <MarkdownView
            key={`ro-md-${index}`}
            content={block.value}
            variant="document"
          />
        ),
      )}
    </div>
  );
}
