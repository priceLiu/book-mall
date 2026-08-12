"use client";

import { Check } from "lucide-react";

import type { ProductDesignProject } from "@/lib/product-design-types";
import {
  ECOM_PROGRESS_RAIL_SHELL,
  progressRailStepButtonClass,
  progressRailStepDotClass,
  progressRailStepLabelClass,
} from "@/lib/ecom-progress-rail-theme";
import {
  PRODUCT_DESIGN_STEPS,
  resolveProductDesignStepStates,
  type ProductDesignStepId,
} from "@/lib/product-design-workflow";

type Props = {
  project: ProductDesignProject;
  onStepClick?: (id: ProductDesignStepId) => void;
};

export function ProductDesignProgressRail({ project, onStepClick }: Props) {
  const states = resolveProductDesignStepStates(project);

  return (
    <nav className={ECOM_PROGRESS_RAIL_SHELL} aria-label="创作进度（点击跳转到对应区块）">
      {PRODUCT_DESIGN_STEPS.map((step) => {
        const state = states[step.id];
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepClick?.(step.id)}
            className={progressRailStepButtonClass(state)}
            title={step.label}
          >
            <span className={progressRailStepDotClass(state)}>
              {state === "done" ? (
                <Check className="h-3 w-3" strokeWidth={3} />
              ) : (
                step.short
              )}
            </span>
            <span className={progressRailStepLabelClass(state)}>{step.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
