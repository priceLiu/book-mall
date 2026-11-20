"use client";

import {
  StoryboardModelPickerDialog,
  STORYBOARD_MODEL_PICKER_DIALOG_CLASS,
} from "@/components/storyboard/storyboard-model-picker-dialog";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

type BaseProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  models: StoryboardGatewayModel[];
  value: string;
  onChange: (key: string) => void;
  onConfirm: (modelKey: string) => void;
  modelsLoading?: boolean;
  modelsEmptyHint?: string;
  onRetryLoadModels?: () => void | Promise<void>;
  dialogTitle?: string;
  dialogDescription?: string;
  confirmLabel?: string;
  footerHint?: string;
  contentClassName?: string;
};

/** 助手 / LLM 模型选择（与图2 生图弹层同布局，仅模型列表） */
export function EcomChatModelPickerDialog({
  dialogTitle = "选择助手模型",
  dialogDescription = "选择 Gateway 文本或多模态模型，用于助手对话与结构化生成。",
  confirmLabel = "确定",
  footerHint = "确认后助手将使用该模型处理后续对话。",
  ...props
}: BaseProps) {
  return (
    <StoryboardModelPickerDialog
      mode="chat"
      hideTypeFilter
      selectionOnly
      dialogTitle={dialogTitle}
      dialogDescription={dialogDescription}
      confirmLabel={confirmLabel}
      footerHint={footerHint}
      {...props}
    />
  );
}

export { STORYBOARD_MODEL_PICKER_DIALOG_CLASS };