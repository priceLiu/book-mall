"use client";

import { Maximize2, Minimize2, PanelRightClose } from "lucide-react";

import {
  EcomAssistantIconButton,
  ECOM_ASSISTANT_CONTROL_ICON_CLASS,
} from "@/components/layout/ecom-assistant-icon-button";

type Props = {
  title: string;
  subtitle?: string;
  composerWide?: boolean;
  onComposerWideChange?: (wide: boolean) => void;
  /** 折叠助手为右下角输入框 */
  onCollapse?: () => void;
  collapseDisabled?: boolean;
  /** 展开钮左侧（如微剧「影片参数」） */
  trailing?: React.ReactNode;
};

/** 电商工具箱 · 右侧助手会话顶栏（手伴创作基准） */
export function EcomAssistantPanelHeader({
  title,
  subtitle,
  composerWide = false,
  onComposerWideChange,
  onCollapse,
  collapseDisabled = false,
  trailing,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[var(--ecom-assistant-border)] bg-[var(--ecom-assistant-bg)] px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#1d1d1f]">{title}</p>
        {subtitle ? (
          <p className="truncate text-[10px] text-[#6e6e73]">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {trailing}
        {onComposerWideChange ? (
          <EcomAssistantIconButton
            variant="muted"
            title={composerWide ? "收窄会话区" : "加宽会话区"}
            onClick={() => onComposerWideChange(!composerWide)}
          >
            {composerWide ? (
              <Minimize2 className={ECOM_ASSISTANT_CONTROL_ICON_CLASS} />
            ) : (
              <Maximize2 className={ECOM_ASSISTANT_CONTROL_ICON_CLASS} />
            )}
          </EcomAssistantIconButton>
        ) : null}
        {onCollapse ? (
          <EcomAssistantIconButton
            variant="muted"
            title={collapseDisabled ? "生成中不可收起" : "收起至右下角输入框"}
            disabled={collapseDisabled}
            onClick={() => onCollapse()}
          >
            <PanelRightClose className={ECOM_ASSISTANT_CONTROL_ICON_CLASS} />
          </EcomAssistantIconButton>
        ) : null}
      </div>
    </div>
  );
}
