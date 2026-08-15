"use client";

import { useEffect, useState } from "react";

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
import { HAND_CRAFT_SKETCH_GEN_DEFAULT_PROMPT } from "@/lib/hand-craft-types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPrompt?: string;
  busy?: boolean;
  hasSeedSketch?: boolean;
  onConfirm: (prompt: string) => void | Promise<void>;
};

/** 生成线稿：编辑 Prompt 后调用 wan2.7-image */
export function HandCraftSketchGenerateDialog({
  open,
  onOpenChange,
  defaultPrompt = HAND_CRAFT_SKETCH_GEN_DEFAULT_PROMPT,
  busy,
  hasSeedSketch,
  onConfirm,
}: Props) {
  const [draft, setDraft] = useState(defaultPrompt);

  useEffect(() => {
    if (open) setDraft(defaultPrompt);
  }, [open, defaultPrompt]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-3">
        <DialogHeader>
          <DialogTitle>生成线稿</DialogTitle>
          <DialogDescription>
            使用通义万相 2.7（wan2.7-image）生成线稿并填入上方槽位。
            {hasSeedSketch
              ? " 将以当前第 1 张线稿为 IP 草图参考，保持造型细节。"
              : " 当前无线稿时将纯文生图；上传 IP 草图后再生成可更好保留造型。"}
          </DialogDescription>
        </DialogHeader>
        <textarea
          className="min-h-[40vh] w-full flex-1 resize-y rounded-lg border border-[#e8e8ed] px-3 py-2.5 text-[13px] leading-relaxed text-[#1d1d1f] focus:border-[#0071e3]/40 focus:outline-none focus:ring-2 focus:ring-[#0071e3]/15 disabled:cursor-not-allowed disabled:bg-[#f5f5f7]"
          value={draft}
          autoFocus
          disabled={busy}
          placeholder="描述期望的线稿风格与角色…"
          onChange={(e) => setDraft(e.target.value)}
        />
        <DialogFooter>
          <EcomDialogCancelButton disabled={busy} onClick={() => onOpenChange(false)}>
            取消
          </EcomDialogCancelButton>
          <EcomDialogPrimaryButton
            disabled={busy || !draft.trim()}
            onClick={() => void onConfirm(draft.trim())}
          >
            {busy ? "生成中…" : "生成"}
          </EcomDialogPrimaryButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
