"use client";

import {
  ECOM_POSE_GENDER_OPTIONS,
  ECOM_POSE_SCENE_TAG_OPTIONS,
  type EcomPoseGender,
} from "@/lib/ecom-pose-library/meta";
import { cn } from "@/lib/utils";

type Props = {
  selectedGenders: EcomPoseGender[];
  selectedSceneTags: string[];
  onGendersChange: (next: EcomPoseGender[]) => void;
  onSceneTagsChange: (next: string[]) => void;
  className?: string;
};

function toggleValue<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function EcomPoseLibraryFilterBar({
  selectedGenders,
  selectedSceneTags,
  onGendersChange,
  onSceneTagsChange,
  className,
}: Props) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-medium text-[var(--ecom-subtle)]">性别</span>
        {ECOM_POSE_GENDER_OPTIONS.map((opt) => {
          const active = selectedGenders.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] transition-colors",
                active
                  ? "border-[var(--ecom-outline-border)] bg-[var(--ecom-content-selected-bg)] text-[var(--ecom-primary)]"
                  : "border-[var(--ecom-border-soft)] bg-white text-[#424245] hover:border-[var(--ecom-subtle)]",
              )}
              onClick={() => onGendersChange(toggleValue(selectedGenders, opt.value))}
            >
              {opt.label}
            </button>
          );
        })}
        {selectedGenders.length ? (
          <button
            type="button"
            className="text-[10px] text-[var(--ecom-subtle)] underline"
            onClick={() => onGendersChange([])}
          >
            清除
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-medium text-[var(--ecom-subtle)]">标签</span>
        {ECOM_POSE_SCENE_TAG_OPTIONS.map((opt) => {
          const active = selectedSceneTags.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] transition-colors",
                active
                  ? "border-[var(--ecom-outline-border)] bg-[var(--ecom-content-selected-bg)] text-[var(--ecom-primary)]"
                  : "border-[var(--ecom-border-soft)] bg-white text-[#424245] hover:border-[var(--ecom-subtle)]",
              )}
              onClick={() => onSceneTagsChange(toggleValue(selectedSceneTags, opt.value))}
            >
              {opt.label}
            </button>
          );
        })}
        {selectedSceneTags.length ? (
          <button
            type="button"
            className="text-[10px] text-[var(--ecom-subtle)] underline"
            onClick={() => onSceneTagsChange([])}
          >
            清除
          </button>
        ) : null}
      </div>
    </div>
  );
}
