"use client";

import { useState } from "react";

import { ProductDesignPromptDialog } from "@/components/product-design/product-design-prompt-dialog";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  placeholder?: string;
  title?: string;
  subtitle?: string;
  className?: string;
};

/** 紧凑 Prompt 框；双击弹出大窗编辑，关闭时写回并触发 onBlur */
export function ProductDesignPromptExpandableTextarea({
  value,
  onChange,
  onBlur,
  disabled,
  placeholder = "生图 Prompt…",
  title = "编辑生图 Prompt",
  subtitle,
  className,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  function handleCommit(next: string) {
    if (next !== value) onChange(next);
    onBlur?.();
  }

  return (
    <>
      <textarea
        className={cn(
          "min-h-[5.5rem] w-full flex-1 rounded-lg border border-[#e8e8ed] px-2 py-1.5 font-mono text-[10px] leading-relaxed",
          !disabled && "cursor-text",
          className,
        )}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        title={disabled ? undefined : "双击放大编辑"}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onDoubleClick={(e) => {
          e.preventDefault();
          if (!disabled) setExpanded(true);
        }}
      />

      <ProductDesignPromptDialog
        open={expanded}
        onOpenChange={setExpanded}
        value={value}
        onCommit={handleCommit}
        disabled={disabled}
        placeholder={placeholder}
        title={title}
        subtitle={subtitle}
      />
    </>
  );
}
