"use client";

import { Check, Home, Smartphone, Sparkles, Shirt } from "lucide-react";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  listSeedVideoSkillDefinitions,
  type SeedVideoSkillDefinition,
  type SeedVideoSkillKey,
} from "@/lib/seed-video-skills";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (skillKey: SeedVideoSkillKey) => void | Promise<void>;
};

function SkillIcon({ skillKey }: { skillKey: SeedVideoSkillKey }) {
  if (skillKey === "fashion-hit") {
    return <Shirt className="h-5 w-5 text-[#0071e3]" />;
  }
  if (skillKey === "digital-product") {
    return <Smartphone className="h-5 w-5 text-[#0071e3]" />;
  }
  if (skillKey === "home-clothes-lounge-wear") {
    return <Home className="h-5 w-5 text-[#0071e3]" />;
  }
  return <Sparkles className="h-5 w-5 text-[#0071e3]" />;
}

export function SeedVideoSkillPickerDialog({ open, onOpenChange, onConfirm }: Props) {
  const skills = listSeedVideoSkillDefinitions();
  const [selected, setSelected] = useState<SeedVideoSkillKey>("seed-grass");
  const [confirming, setConfirming] = useState(false);

  async function handleConfirm() {
    setConfirming(true);
    try {
      await onConfirm(selected);
      onOpenChange(false);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setSelected("seed-grass");
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-w-lg flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-[#f0f0f2] px-5 py-4">
          <DialogTitle className="text-[15px]">选择创作类型</DialogTitle>
          <p className="text-[12px] text-[#86868b]">
            不同类型使用不同的策划 Skill；创建后不可切换，需新建项目更换。
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-2 px-5 py-4">
          {skills.map((skill) => (
            <SkillCard
              key={skill.key}
              skill={skill}
              active={selected === skill.key}
              onSelect={() => setSelected(skill.key)}
            />
          ))}
        </div>

        <DialogFooter className="border-t border-[#f0f0f2] px-5 py-3">
          <EcomButtonSecondary size="sm" type="button" onClick={() => onOpenChange(false)}>
            取消
          </EcomButtonSecondary>
          <EcomButtonPrimary
            size="sm"
            type="button"
            disabled={confirming}
            onClick={() => void handleConfirm()}
          >
            {confirming ? "创建中…" : "开始创作"}
          </EcomButtonPrimary>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SkillCard({
  skill,
  active,
  onSelect,
}: {
  skill: SeedVideoSkillDefinition;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 rounded-xl border-2 p-3 text-left transition-colors",
        active ? "border-[#0071e3] bg-[#f0f6ff]" : "border-[#e8e8ed] bg-white hover:border-[#d2d2d7]",
      )}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white shadow-sm">
        <SkillIcon skillKey={skill.key} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-[#1d1d1f]">{skill.label}</span>
        <span className="mt-0.5 block text-[12px] leading-relaxed text-[#86868b]">
          {skill.description}
        </span>
      </span>
      {active ? (
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#0071e3] text-white">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      ) : null}
    </button>
  );
}
