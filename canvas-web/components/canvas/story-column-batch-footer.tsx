"use client";

import {
  storyEditionBatchBtnClass,
  type StoryEdition,
} from "@/lib/canvas/story-edition-chrome";
import { STORY_ORANGE_BTN_CLASS } from "@/lib/canvas/story-node-chrome";

export { STORY_ORANGE_BTN_CLASS };

/** 漫剧三列节点底栏：固定在 NodeShell 底部，不随内容滚动 */
export function StoryColumnBatchFooter({
  children,
  disabled,
  onClick,
  edition = "comic",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  edition?: StoryEdition;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`nodrag h-9 w-full text-[12px] ${storyEditionBatchBtnClass(edition)}`}
      title={disabled ? "请先在上方选择模型" : undefined}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
