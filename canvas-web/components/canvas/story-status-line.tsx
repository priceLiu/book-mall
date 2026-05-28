"use client";

import { cn } from "@/lib/utils";
import {
  STORY_CHROME_GREEN_CLASS,
  STORY_ERROR_LINE_CLASS,
  STORY_HINT_GOLD_CLASS,
} from "@/lib/canvas/story-column-sync";

/** 错误信息：单行省略，hover 显示全文（图 3） */
export function StoryErrorLine({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <p className={cn(STORY_ERROR_LINE_CLASS, className)} title={message}>
      {message}
    </p>
  );
}

/** 说明 / 前置条件类提示（图 2 金黄） */
export function StoryHintLine({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[10px] leading-relaxed",
        STORY_HINT_GOLD_CLASS,
        className,
      )}
      title={message}
    >
      {message}
    </p>
  );
}

/** 节点内状态 / 区块说明（绿色） */
export function StoryStatusLine({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[10px] leading-relaxed",
        STORY_CHROME_GREEN_CLASS,
        className,
      )}
      title={message}
    >
      {message}
    </p>
  );
}
