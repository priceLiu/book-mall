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
    return <Shirt className="h-5 w-5 text-[var(--ecom-primary)]" />;
  }
  if (skillKey === "digital-product") {
    return <Smartphone className="h-5 w-5 text-[var(--ecom-primary)]" />;
  }
  if (skillKey === "home-clothes-lounge-wear") {
    return <Home className="h-5 w-5 text-[var(--ecom-primary)]" />;
  }
  return <Sparkles className="h-5 w-5 text-[var(--ecom-primary)]" />;
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
          <p className="text-[12px] text-[var(--ecom-subtle)]">
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
        active ? "border-[var(--ecom-outline-border)] bg-[var(--ecom-content-selected-bg)]" : "border-[var(--ecom-divider)] bg-white hover:border-[var(--ecom-border-soft)]",
      )}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white shadow-sm">
        <SkillIcon skillKey={skill.key} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-[var(--ecom-ink)]">{skill.label}</span>
        <span className="mt-0.5 block text-[12px] leading-relaxed text-[var(--ecom-subtle)]">
          {skill.description}
        </span>
      </span>
      {active ? (
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--ecom-primary)] text-white">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      ) : null}
    </button>
  );
}
