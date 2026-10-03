"use client";

import {
  ECOM_PROGRESS_RAIL_SHELL,
  progressRailStepButtonClass,
  progressRailStepDotClass,
  progressRailStepLabelClass,
} from "@/lib/ecom-progress-rail-theme";
import type { IpMasterStepId } from "@/lib/ip-master-types";
import { IP_MASTER_STEPS } from "@/lib/ip-master-workflow";

type Props = {
  currentStepId: IpMasterStepId;
  onStepClick?: (id: IpMasterStepId) => void;
};

export function IpMasterProgressRail({ currentStepId, onStepClick }: Props) {
  return (
    <nav className={ECOM_PROGRESS_RAIL_SHELL} aria-label="IP 母版 4 步进度（可自由切换）">
      {IP_MASTER_STEPS.map((step) => {
        const state: "active" | "pending" =
          step.id === currentStepId ? "active" : "pending";
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepClick?.(step.id)}
            className={progressRailStepButtonClass(state)}
            title={`第 ${step.no} 步 ${step.label}｜${step.summary}`}
          >
            <span className={progressRailStepDotClass(state)}>{step.short}</span>
            <span className={progressRailStepLabelClass(state)}>{step.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
