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
import type { VtonTryonRefinerGender } from "@/lib/vton-types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  defaultGender?: VtonTryonRefinerGender;
  onClose: () => void;
  onConfirm: (gender: VtonTryonRefinerGender) => void;
};

function GenderOption({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex-1 rounded-lg border px-3 py-2 text-sm transition",
        selected
          ? "border-[#0071e3] bg-[#f0f6ff] text-[#0071e3]"
          : "border-[#e8e8ed] bg-white text-[#1d1d1f] hover:border-[#0071e3]/40",
      )}
      onClick={onSelect}
    >
      {label}
    </button>
  );
}

export function VtonRefineGenderDialog({ open, defaultGender, onClose, onConfirm }: Props) {
  const [gender, setGender] = useState<VtonTryonRefinerGender>(defaultGender ?? "woman");

  useEffect(() => {
    if (open) setGender(defaultGender ?? "woman");
  }, [open, defaultGender]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>试衣精修</DialogTitle>
          <DialogDescription>
            百炼 aitryon-refiner 需指定模特性别，用于优化试衣成片细节与面部。
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <GenderOption
            label="女模"
            selected={gender === "woman"}
            onSelect={() => setGender("woman")}
          />
          <GenderOption
            label="男模"
            selected={gender === "man"}
            onSelect={() => setGender("man")}
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <EcomDialogCancelButton type="button" onClick={onClose}>
            取消
          </EcomDialogCancelButton>
          <EcomDialogPrimaryButton type="button" onClick={() => onConfirm(gender)}>
            开始精修
          </EcomDialogPrimaryButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
