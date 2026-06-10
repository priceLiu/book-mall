"use client";

import { useEffect, useState } from "react";

import {
  joinMarkdownBlocks,
  prepareMarkdownForPreview,
  splitMarkdownByGfmTables,
  type MarkdownBlock,
} from "@/lib/canvas/parse-md-tables";
import { MarkdownView } from "./markdown-view";
import type { MentionableItem } from "./mentions/MentionsTextarea";
import { MentionsTextarea } from "./mentions/MentionsTextarea";
import {
  canEditGenericMdTable,
  StoryGenericMdTableEditor,
} from "./story-generic-md-table-editor";

const DOC_TEXT =
  "w-full resize-none border-0 bg-transparent font-sans text-[17px] leading-[1.85] text-neutral-800 shadow-none focus:outline-none focus:ring-0";

function splitOutlineBlocks(md: string): MarkdownBlock[] {
  const normalized = prepareMarkdownForPreview(md);
  const split = splitMarkdownByGfmTables(normalized);
  if (split.length) return split;
  if (normalized.trim()) return [{ kind: "text", value: normalized.trim() }];
  return [];
}

function textareaRows(text: string): number {
  return Math.max(4, text.split("\n").length + 2);
}

/**
 * 故事大纲 · 块级渲染编辑（无 Lexical/MDXEditor，兼容旧项目 Markdown）
 * - 表格：可编辑 GFM 表（与角色设定同款）
 * - 正文：上方实时渲染 + 下方 Markdown 编辑区（编辑时渲染不消失）
 */
export function StoryOutlineDocumentEditor({
  value,
  onChange,
  readOnly = false,
  mentionables,
  editHint,
}: {
  value: string;
  onChange: (md: string) => void;
  readOnly?: boolean;
  /** 正文块编辑时启用 @ 引用（如导演提示词引用上传剧本） */
  mentionables?: MentionableItem[];
  editHint?: string;
}) {
  const [blocks, setBlocks] = useState<MarkdownBlock[]>(() =>
    splitOutlineBlocks(value),
  );
  const [editingTextIndex, setEditingTextIndex] = useState<number | null>(null);

  useEffect(() => {
    if (editingTextIndex !== null) return;
    setBlocks(splitOutlineBlocks(value));
  }, [value, editingTextIndex]);

  const commitBlocks = (next: MarkdownBlock[]) => {
    setBlocks(next);
    onChange(joinMarkdownBlocks(next));
  };

  const patchBlock = (index: number, blockValue: string) => {
    commitBlocks(
      blocks.map((b, i) => (i === index ? { ...b, value: blockValue } : b)),
    );
  };

  if (readOnly) {
    if (!value.trim()) {
      return (
        <p className="text-[17px] leading-[1.85] text-neutral-500">（暂无内容）</p>
      );
    }
    return (
      <div className="nodrag flex min-h-0 w-full flex-1 flex-col gap-6">
        {splitOutlineBlocks(value).map((block, index) =>
          block.kind === "table" ? (
            canEditGenericMdTable(block.value) ? (
              <StoryGenericMdTableEditor
                key={`ro-table-${index}`}
                value={block.value}
                readOnly
                onChange={() => {}}
              />
            ) : (
              <MarkdownView
                key={`ro-table-md-${index}`}
                content={block.value}
                variant="document"
              />
            )
          ) : (
            <MarkdownView
              key={`ro-text-${index}`}
              content={block.value}
              variant="document"
            />
          ),
        )}
      </div>
    );
  }

  const emptyEditor =
    mentionables?.length ? (
      <MentionsTextarea
        className={`nodrag ${DOC_TEXT} block min-h-0 w-full flex-1`}
        value={value}
        mentionables={mentionables}
        onChange={(next) => onChange(next)}
        placeholder="输入 @ 引用上传剧本…"
      />
    ) : (
      <textarea
        className={`nodrag ${DOC_TEXT} block min-h-0 w-full flex-1`}
        rows={16}
        placeholder="撰写故事大纲（支持 Markdown 标题、段落与 GFM 表格）…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
    );

  if (!blocks.length) {
    return emptyEditor;
  }

  const hint =
    editHint ??
    "表格可直接点单元格编辑；正文点段落后，上方保持渲染预览、下方编辑 Markdown";

  return (
    <div className="nodrag flex min-h-0 w-full flex-1 flex-col gap-6">
      <p className="text-[12px] text-neutral-500">{hint}</p>
      {blocks.map((block, index) => {
        if (block.kind === "table" && canEditGenericMdTable(block.value)) {
          return (
            <StoryGenericMdTableEditor
              key={`table-${index}`}
              value={block.value}
              onChange={(md) => patchBlock(index, md)}
            />
          );
        }

        if (block.kind === "table") {
          return (
            <div key={`table-fallback-${index}`} className="overflow-x-auto">
              <MarkdownView content={block.value} variant="document" />
            </div>
          );
        }

        const isEditing = editingTextIndex === index;

        return (
          <div
            key={`text-${index}`}
            className={
              isEditing
                ? "rounded-md border border-[#fb923c]/35 bg-amber-50/25 p-3"
                : "min-w-0"
            }
          >
            <div
              role={isEditing ? undefined : "button"}
              tabIndex={isEditing ? undefined : 0}
              className={
                isEditing
                  ? "min-w-0"
                  : "min-w-0 cursor-text rounded-md transition hover:bg-amber-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fb923c]/50"
              }
              onClick={() => {
                if (!isEditing) setEditingTextIndex(index);
              }}
              onKeyDown={(e) => {
                if (isEditing) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setEditingTextIndex(index);
                }
              }}
            >
              <MarkdownView content={block.value} variant="document" />
            </div>
            {isEditing ? (
              <div className="mt-3 border-t border-neutral-200/80 pt-3">
                {mentionables?.length ? (
                  <MentionsTextarea
                    className={`nodrag ${DOC_TEXT} block w-full rounded-md bg-white/80 p-2`}
                    rows={textareaRows(block.value)}
                    value={block.value}
                    mentionables={mentionables}
                    autoFocus
                    onChange={(next) => patchBlock(index, next)}
                    onBlur={() => setEditingTextIndex(null)}
                    placeholder="输入 @ 引用上传剧本…"
                  />
                ) : (
                  <textarea
                    className={`nodrag ${DOC_TEXT} block w-full rounded-md bg-white/80 p-2`}
                    rows={textareaRows(block.value)}
                    value={block.value}
                    autoFocus
                    spellCheck={false}
                    onChange={(e) => patchBlock(index, e.target.value)}
                    onBlur={() => setEditingTextIndex(null)}
                  />
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
