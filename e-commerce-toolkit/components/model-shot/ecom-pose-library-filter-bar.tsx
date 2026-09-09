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
        <span className="text-[10px] font-medium text-[#86868b]">性别</span>
        {ECOM_POSE_GENDER_OPTIONS.map((opt) => {
          const active = selectedGenders.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] transition-colors",
                active
                  ? "border-[#0071e3] bg-[#f0f6ff] text-[#0071e3]"
                  : "border-[#d2d2d7] bg-white text-[#424245] hover:border-[#86868b]",
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
            className="text-[10px] text-[#86868b] underline"
            onClick={() => onGendersChange([])}
          >
            清除
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-medium text-[#86868b]">标签</span>
        {ECOM_POSE_SCENE_TAG_OPTIONS.map((opt) => {
          const active = selectedSceneTags.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] transition-colors",
                active
                  ? "border-[#0071e3] bg-[#f0f6ff] text-[#0071e3]"
                  : "border-[#d2d2d7] bg-white text-[#424245] hover:border-[#86868b]",
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
            className="text-[10px] text-[#86868b] underline"
            onClick={() => onSceneTagsChange([])}
          >
            清除
          </button>
        ) : null}
      </div>
    </div>
  );
}
