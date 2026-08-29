"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EcomDialogCancelButton,
  EcomDialogPrimaryButton,
} from "@/components/ui/dialog";

export type FashionCharacterRefChoice = "ai" | "upload";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (choice: FashionCharacterRefChoice) => void;
};

/**
 * 服装路径 B · 首次生图前选择角色参考方式。
 */
export function FashionCharacterRefChoiceDialog({ open, onOpenChange, onChoose }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>选择角色参考方式</DialogTitle>
          <DialogDescription>
            生成分镜图需要角色参考。请选择自行上传角色图，或由 AI 根据脚本自动生成角色参考图（首次生图时执行，不单独展示提示词）。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <EcomDialogCancelButton onClick={() => onOpenChange(false)}>取消</EcomDialogCancelButton>
          <EcomDialogCancelButton type="button" onClick={() => onChoose("upload")}>
            自行上传
          </EcomDialogCancelButton>
          <EcomDialogPrimaryButton type="button" onClick={() => onChoose("ai")}>
            AI 生成
          </EcomDialogPrimaryButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}