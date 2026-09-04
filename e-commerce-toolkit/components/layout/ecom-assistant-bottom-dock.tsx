"use client";

import type { ReactNode } from "react";

import { ECOM_ASSISTANT_FLOATING_COMPOSER_SHELL_CLASS } from "@/lib/ecom-assistant-chat-styles";
import { cn } from "@/lib/utils";

type Props = {
  composer: ReactNode;
  className?: string;
  /** 底栏外层（居中宽度） */
  dockClassName?: string;
  /** 扫光（生成/拆解进行中 · 对齐拆图拆视频底栏） */
  composerSweep?: boolean;
};

/** 助手底栏：仅 Composer 输入条（Cursor 式，无会话标题/消息区）。 */
export function EcomAssistantBottomDock({
  composer,
  className,
  dockClassName,
  composerSweep,
}: Props) {
  return (
    <div
      className={cn(
        "shrink-0 border-t border-[var(--ecom-assistant-border)] bg-[var(--ecom-assistant-bg)]",
        className,
      )}
      data-ecom-assistant-bottom-dock
    >
      <div className={cn("px-4 pb-4 pt-2", dockClassName)}>
        <div className="relative mx-auto w-full max-w-[min(100%,42rem)]">
          <div
            className={cn(
              ECOM_ASSISTANT_FLOATING_COMPOSER_SHELL_CLASS,
              "rounded-[1.75rem] px-3 py-2",
              composerSweep && "ecom-media-generating-sweep",
            )}
          >
            <div className="min-w-0 flex-1">{composer}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
