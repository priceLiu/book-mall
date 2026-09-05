"use client";

import { EcomFullScreenOverlay } from "@/components/ui/ecom-full-screen-overlay";
import { EcomDialogCancelButton, EcomDialogPrimaryButton } from "@/components/ui/dialog";

export type FashionCharacterRefChoice = "ai" | "upload";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (choice: FashionCharacterRefChoice) => void;
};

/**
 * 服装路径 B · 首次生图前选择角色参考方式。
 * 使用 portal 全屏层，避免与 StoryboardModelPickerDialog 叠加 Radix Presence 循环。
 */
export function FashionCharacterRefChoiceDialog({ open, onOpenChange, onChoose }: Props) {
  return (
    <EcomFullScreenOverlay
      open={open}
      onClose={() => onOpenChange(false)}
      title="选择角色参考方式"
      description="生成分镜图需要角色参考。请选择自行上传角色图，或由 AI 根据脚本自动生成角色参考图（首次生图时执行，不单独展示提示词）。"
      panelClassName="max-h-none w-[min(94vw,28rem)] max-w-none"
      backdropClassName="bg-black/45"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <EcomDialogCancelButton onClick={() => onOpenChange(false)}>取消</EcomDialogCancelButton>
          <EcomDialogCancelButton type="button" onClick={() => onChoose("upload")}>
            自行上传
          </EcomDialogCancelButton>
          <EcomDialogPrimaryButton type="button" onClick={() => onChoose("ai")}>
            AI 生成
          </EcomDialogPrimaryButton>
        </div>
      }
    >
      <div className="px-5 py-2" />
    </EcomFullScreenOverlay>
  );
}
