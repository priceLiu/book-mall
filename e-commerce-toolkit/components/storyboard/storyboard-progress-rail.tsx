"use client";

import { Check, Minus } from "lucide-react";

import type { StoryboardProject } from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

export type StoryboardStepId =
  | "plan"
  | "product"
  | "character"
  | "refs"
  | "script"
  | "images"
  | "video";

const STEPS: { id: StoryboardStepId; label: string }[] = [
  { id: "plan", label: "策划" },
  { id: "product", label: "产品图" },
  { id: "character", label: "角色图" },
  { id: "refs", label: "场景图" },
  { id: "script", label: "分镜脚本" },
  { id: "images", label: "分镜图" },
  { id: "video", label: "成片" },
];

type StepVisual = "done" | "skipped" | "active" | "pending";

function resolveStepState(
  project: StoryboardProject,
  hasVideo: boolean,
): Record<StoryboardStepId, StepVisual> {
  const wf = project.meta?.workflow ?? {};
  const hasDeliverable =
    Boolean(project.meta?.deliverable) ||
    Boolean(project.meta?.deliverableMarkdown) ||
    Boolean(project.sheet);
  const hasProduct = project.references.some((r) => r.role === "product");
  const hasCharacter =
    project.references.some((r) => r.role === "character") ||
    Boolean(wf.autoGenCharacter) ||
    Boolean(wf.characterPresetKey);
  const hasOtherRef = project.references.some(
    (r) => r.role === "scene" || r.role === "other",
  );
  const hasScript = Boolean(project.sheet);
  const hasImages = Boolean(
    project.sheetPngUrl || project.sheet?.panels?.some((p) => p.imageUrl),
  );

  const productDone = hasProduct;
  const characterDone = hasCharacter || Boolean(wf.skippedCharacter);
  const refsDone =
    hasOtherRef ||
    Boolean(wf.scenePreset) ||
    Boolean(wf.scenePresetCustom) ||
    Boolean(wf.skippedRefs);

  let active: StoryboardStepId = "plan";
  if (hasVideo) active = "video";
  else if (hasImages) active = "video";
  else if (hasScript) active = "images";
  else if (hasDeliverable) {
    if (!productDone) active = "product";
    else if (!characterDone) active = "character";
    else if (!refsDone) active = "refs";
    else active = "script";
  }

  const doneMap: Record<StoryboardStepId, boolean> = {
    plan: hasDeliverable,
    product: productDone,
    character: characterDone,
    refs: refsDone,
    script: hasScript,
    images: hasImages,
    video: hasVideo,
  };

  const skippedMap: Record<StoryboardStepId, boolean> = {
    plan: false,
    product: false,
    character: Boolean(wf.skippedCharacter) && !hasCharacter,
    refs:
      Boolean(wf.skippedRefs) && !hasOtherRef && !wf.scenePreset && !wf.scenePresetCustom,
    script: false,
    images: false,
    video: false,
  };

  const out = {} as Record<StoryboardStepId, StepVisual>;
  for (const s of STEPS) {
    if (doneMap[s.id] && !skippedMap[s.id]) out[s.id] = "done";
    else if (skippedMap[s.id]) out[s.id] = "skipped";
    else if (s.id === active) out[s.id] = "active";
    else out[s.id] = "pending";
  }
  return out;
}

type Props = {
  project: StoryboardProject;
  hasVideo?: boolean;
  onStepClick?: (id: StoryboardStepId) => void;
};

export function StoryboardProgressRail({ project, hasVideo, onStepClick }: Props) {
  const states = resolveStepState(project, Boolean(hasVideo));

  return (
    <nav
      className="flex w-[4.75rem] shrink-0 flex-col items-center gap-0.5 border-r border-[#e8e8ed] bg-white py-3"
      aria-label="创作进度"
    >
      {STEPS.map((step) => {
        const state = states[step.id];
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepClick?.(step.id)}
            className={cn(
              "relative flex w-full flex-col items-center gap-0.5 px-0.5 py-1.5 text-center transition-colors",
              state === "active" && "text-[#1d1d1f]",
              (state === "done" || state === "skipped") && "text-[#1d1d1f]",
              state === "pending" && "text-[#86868b]",
            )}
            title={step.label}
          >
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold",
                state === "active" && "bg-[#e8e8ed] ring-2 ring-[#1d1d1f]",
                state === "done" && "bg-[#1d1d1f] text-white",
                state === "skipped" && "border border-[#d2d2d7] bg-[#f5f5f7] text-[#86868b]",
                state === "pending" && "border border-[#e8e8ed] bg-white text-[#86868b]",
              )}
            >
              {state === "done" ? (
                <Check className="h-3 w-3" strokeWidth={3} />
              ) : state === "skipped" ? (
                <Minus className="h-3 w-3" strokeWidth={3} />
              ) : (
                step.label.slice(0, 1)
              )}
            </span>
            <span className="text-[9px] font-bold leading-tight">{step.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
