"use client";

import { Check } from "lucide-react";

import {
  ECOM_PROGRESS_RAIL_SHELL,
  progressRailStepButtonClass,
  progressRailStepDotClass,
  progressRailStepLabelClass,
  type ProgressRailStepState,
} from "@/lib/ecom-progress-rail-theme";
import {
  inferSimpleFusionWorkflowStep,
  SIMPLE_FUSION_WORKFLOW_STEPS,
  type SimpleFusionWorkflowStepId,
} from "@/lib/simple-fusion-workflow";
import type { SimpleFusionProject } from "@/lib/ecom-simple-fusion-video-api";
import type { SimpleFusionPreviewSlot } from "@/lib/simple-fusion-preview-slots";

function stepVisual(
  current: SimpleFusionWorkflowStepId,
  stepId: SimpleFusionWorkflowStepId,
  garmentMulti: boolean,
): ProgressRailStepState {
  const order: SimpleFusionWorkflowStepId[] = garmentMulti
    ? ["fusion", "clips", "compose"]
    : ["fusion", "clips"];
  const ci = order.indexOf(current);
  const si = order.indexOf(stepId);
  if (si < 0) return "skipped";
  if (si < ci) return "done";
  if (si === ci) return "active";
  return "pending";
}

type Props = {
  project: SimpleFusionProject;
  previewSlots: SimpleFusionPreviewSlot[];
  garmentMulti: boolean;
};

export function SimpleFusionProgressRail({ project, previewSlots, garmentMulti }: Props) {
  const current = inferSimpleFusionWorkflowStep(project, previewSlots, { garmentMulti });
  const steps = garmentMulti
    ? SIMPLE_FUSION_WORKFLOW_STEPS
    : SIMPLE_FUSION_WORKFLOW_STEPS.filter((s) => s.id !== "compose");

  return (
    <nav className={ECOM_PROGRESS_RAIL_SHELL} aria-label="简易融合短视频创作步骤">
      {steps.map((step) => {
        const state = stepVisual(current, step.id, garmentMulti);
        return (
          <div key={step.id} className={progressRailStepButtonClass(state)} title={step.label}>
            <span className={progressRailStepDotClass(state)}>
              {state === "done" ? (
                <Check className="h-3 w-3" strokeWidth={3} />
              ) : (
                step.short
              )}
            </span>
            <span className={progressRailStepLabelClass(state)}>{step.label}</span>
          </div>
        );
      })}
    </nav>
  );
}
