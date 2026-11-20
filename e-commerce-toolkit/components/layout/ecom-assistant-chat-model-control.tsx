"use client";

import { Cpu } from "lucide-react";
import { useEffect, useState } from "react";

import { EcomChatModelPickerDialog } from "@/components/storyboard/ecom-chat-model-picker-dialog";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

type Props = {
  models: StoryboardGatewayModel[];
  value: string;
  onChange: (modelKey: string) => void;
  disabled?: boolean;
  modelsLoading?: boolean;
  modelsEmptyHint?: string;
  onRetryLoadModels?: () => void | Promise<void>;
  /** 紧凑：仅图标+短文案，用于助手顶栏 trailing */
  variant?: "button" | "compact";
  className?: string;
};

/** 助手区 · 模型选择（统一图2 弹层） */
export function EcomAssistantChatModelControl({
  models,
  value,
  onChange,
  disabled,
  modelsLoading,
  modelsEmptyHint,
  onRetryLoadModels,
  variant = "compact",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draftKey, setDraftKey] = useState(value);

  useEffect(() => {
    if (open) setDraftKey(value);
  }, [open, value]);

  const label =
    models.find((m) => m.modelKey === value)?.displayName ?? "助手模型";

  return (
    <>
      {variant === "compact" ? (
        <EcomButtonSecondary
          type="button"
          size="sm"
          disabled={disabled || modelsLoading}
          className={cn(
            "h-8 max-w-[min(100%,11rem)] gap-1 truncate px-2 text-[11px] font-medium",
            className,
          )}
          title={label}
          onClick={() => setOpen(true)}
        >
          <Cpu className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{modelsLoading ? "加载…" : label}</span>
        </EcomButtonSecondary>
      ) : (
        <EcomButtonSecondary
          type="button"
          size="sm"
          disabled={disabled || modelsLoading}
          className={cn("h-9 gap-1.5", className)}
          onClick={() => setOpen(true)}
        >
          <Cpu className="h-3.5 w-3.5 shrink-0" />
          {modelsLoading ? "加载模型…" : label}
        </EcomButtonSecondary>
      )}

      <EcomChatModelPickerDialog
        open={open}
        onOpenChange={setOpen}
        models={models}
        modelsLoading={modelsLoading}
        modelsEmptyHint={modelsEmptyHint}
        onRetryLoadModels={onRetryLoadModels}
        value={draftKey}
        onChange={setDraftKey}
        onConfirm={(key) => {
          onChange(key);
          setOpen(false);
        }}
      />
    </>
  );
}