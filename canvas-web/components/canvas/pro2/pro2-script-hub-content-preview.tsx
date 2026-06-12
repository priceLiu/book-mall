"use client";

import { useMemo } from "react";
import { GripVertical, Maximize2, User } from "lucide-react";
import { parseCharacterRows, parseStoryboardRows } from "@/lib/canvas/parse-md-tables";
import type { Pro2ScriptHubViewTab } from "@/lib/canvas/pro2-script-hub-view-types";
import { RF_NODE_DRAG_HANDLE } from "@/lib/canvas/react-flow-classes";
import { PRO2_TEXT_NODE_TITLE_CLASS } from "@/lib/canvas/story-pro2-node-chrome";
import { cn } from "@/lib/utils";
import { Pro2ScriptHubViewTabs } from "./pro2-script-hub-view-tabs";

const STORYBOARD_COLS = [
  { key: "frameIndex", label: "镜号", className: "w-10 text-center" },
  { key: "shotSize", label: "景别", className: "w-14 whitespace-nowrap" },
  { key: "cameraMove", label: "运镜", className: "w-14 whitespace-nowrap" },
  { key: "description", label: "画面描述", className: "min-w-[140px]" },
  { key: "dialogue", label: "对白", className: "min-w-[100px]" },
  { key: "duration", label: "时长", className: "w-10 text-center" },
  { key: "aiVideoPrompt", label: "AI视频提示词", className: "min-w-[120px]" },
  { key: "lipSyncNote", label: "口型/配音", className: "min-w-[80px]" },
] as const;

const CHARACTER_COLS = [
  { key: "name", label: "姓名", className: "w-16 whitespace-nowrap" },
  { key: "role", label: "身份", className: "min-w-[88px]" },
  { key: "appearance", label: "外貌关键词", className: "min-w-[120px]" },
  { key: "personality", label: "性格", className: "min-w-[80px]" },
] as const;

const TABLE =
  "w-max min-w-full border-collapse border border-violet-400/20 text-left text-[10px]";
const TH =
  "border border-violet-400/15 bg-violet-500/10 px-2 py-1 font-medium text-violet-100/90 whitespace-nowrap";
const TD =
  "border border-violet-400/10 bg-black/20 align-top px-2 py-1 text-white/75";

/** 2.0 脚本节点 · 角色 / 分镜表卡片预览 */
export function Pro2ScriptHubContentPreview({
  characterMd,
  storyboardMd,
  title,
  tab,
  onTabChange,
  className,
  onExpand,
}: {
  characterMd: string;
  storyboardMd: string;
  title?: string;
  tab: Pro2ScriptHubViewTab;
  onTabChange: (tab: Pro2ScriptHubViewTab) => void;
  className?: string;
  onExpand?: () => void;
}) {
  const characterRows = useMemo(
    () => parseCharacterRows(characterMd),
    [characterMd],
  );
  const storyboardRows = useMemo(
    () => parseStoryboardRows(storyboardMd),
    [storyboardMd],
  );

  const emptyMessage =
    tab === "character" ? "暂无角色设定" : "暂无分镜脚本";
  const rows = tab === "character" ? characterRows : storyboardRows;
  const cols = tab === "character" ? CHARACTER_COLS : STORYBOARD_COLS;

  if (!characterRows.length && !storyboardRows.length) {
    return (
      <p className="text-center text-[11px] text-white/40">暂无脚本内容</p>
    );
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      {title ? (
        <header
          className={cn(
            RF_NODE_DRAG_HANDLE,
            PRO2_TEXT_NODE_TITLE_CLASS,
            "mb-1.5 justify-between border-b border-white/[0.06] pb-1.5",
          )}
          title="拖动标题栏移动节点"
        >
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <GripVertical className="size-3.5 shrink-0 text-white/30" />
            <User className="size-3.5 shrink-0 text-white/45" />
            <p className="min-w-0 flex-1 truncate font-medium text-white/85">
              {title}
            </p>
          </div>
          <div className="nodrag flex shrink-0 items-center gap-1">
            <Pro2ScriptHubViewTabs
              value={tab}
              onChange={onTabChange}
              size="compact"
            />
            {onExpand ? (
              <button
                type="button"
                className="nodrag rounded-md p-1 text-white/45 transition hover:bg-white/8 hover:text-white/80"
                title="放大编辑"
                onClick={(e) => {
                  e.stopPropagation();
                  onExpand();
                }}
              >
                <Maximize2 className="size-3.5" />
              </button>
            ) : null}
          </div>
        </header>
      ) : null}
      <div className="pro2-node-scroll nodrag min-h-0 flex-1 overflow-x-auto overflow-y-auto">
        {!rows.length ? (
          <p className="py-6 text-center text-[11px] text-white/40">
            {emptyMessage}
          </p>
        ) : (
          <table className={TABLE}>
            <thead className="sticky top-0 z-[1]">
              <tr>
                {cols.map((col) => (
                  <th key={col.key} className={TH}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tab === "character"
                ? characterRows.map((row, index) => (
                    <tr key={`${row.name}-${index}`}>
                      {CHARACTER_COLS.map((col) => {
                        const text =
                          String(row[col.key as keyof typeof row] ?? "").trim() ||
                          "—";
                        return (
                          <td key={col.key} className={cn(TD, col.className)}>
                            <p
                              className={cn(
                                "text-[10px] leading-snug",
                                col.key === "appearance" || col.key === "role"
                                  ? "line-clamp-3"
                                  : "",
                              )}
                            >
                              {text}
                            </p>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                : storyboardRows.map((row) => (
                    <tr key={row.frameIndex}>
                      {STORYBOARD_COLS.map((col) => {
                        const raw = row[col.key as keyof typeof row];
                        const text =
                          col.key === "frameIndex"
                            ? String(row.frameIndex)
                            : String(raw ?? "").trim() || "—";
                        return (
                          <td key={col.key} className={cn(TD, col.className)}>
                            <p
                              className={cn(
                                "text-[10px] leading-snug",
                                col.key === "description" ||
                                  col.key === "aiVideoPrompt" ||
                                  col.key === "dialogue"
                                  ? "line-clamp-3"
                                  : "",
                              )}
                            >
                              {text}
                            </p>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
