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
  SUITE_RAIL_STEPS,
  type DetailPageSuitePhase,
  type DetailPageSuiteProject,
} from "@/lib/detail-page-suite-types";

function phaseIndex(phase: DetailPageSuitePhase | undefined): number {
  const i = SUITE_RAIL_STEPS.findIndex((s) => s.id === phase);
  return i < 0 ? 0 : i;
}

function railState(project: DetailPageSuiteProject, id: DetailPageSuitePhase): ProgressRailStepState {
  const current = phaseIndex(project.meta?.phase ?? "product_ref");
  const idx = phaseIndex(id);
  if (idx < current) return "done";
  if (idx === current) return "active";
  return "pending";
}

export function DetailPageSuiteProgressRail({ project }: { project: DetailPageSuiteProject }) {
  return (
    <nav className={ECOM_PROGRESS_RAIL_SHELL} aria-label="详情页套图进度">
      {SUITE_RAIL_STEPS.map((step) => {
        const state = railState(project, step.id);
        return (
          <div key={step.id} className={progressRailStepButtonClass(state)} title={step.label}>
            <span className={progressRailStepDotClass(state)}>
              {state === "done" ? <Check className="h-3 w-3" strokeWidth={3} /> : step.short}
            </span>
            <span className={progressRailStepLabelClass(state)}>{step.label}</span>
          </div>
        );
      })}
    </nav>
  );
}
