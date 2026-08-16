import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import type { ComposeProgressStep } from "@/lib/ai-space/ai-space-compose-types";

export function isComposeTaskRunning(status: string): boolean {
  return status === "pending" || status === "generating_human" || status === "composing";
}

export function ComposeStepIcon({ status }: { status: ComposeProgressStep["status"] }) {
  if (status === "done") {
    return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#1a7f37]" />;
  }
  if (status === "failed") {
    return <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />;
  }
  if (status === "running") {
    return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#0969da]" />;
  }
  return (
    <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-[#d0d7de] bg-[#f6f8fa]" />
  );
}

export function ComposeProgressSteps({ steps }: { steps: ComposeProgressStep[] }) {
  return (
    <ol className="mt-2 space-y-1.5 border-t border-[#eaeef2] pt-2">
      {steps.map((step) => (
        <li key={step.id} className="flex gap-2 text-xs">
          <ComposeStepIcon status={step.status} />
          <div className="min-w-0 flex-1">
            <div
              className={
                step.status === "running"
                  ? "font-medium text-[#1f2328]"
                  : step.status === "failed"
                    ? "font-medium text-destructive"
                    : step.status === "done"
                      ? "text-[#656d76]"
                      : "text-[#8c959f]"
              }
            >
              {step.label}
            </div>
            {step.detail ? (
              <p className="mt-0.5 break-all text-[#8c959f]">{step.detail}</p>
            ) : null}
            {step.status === "running" &&
            step.progress != null &&
            step.progress > 0 ? (
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[#eaeef2]">
                <div
                  className="h-full rounded-full bg-[#0969da] transition-all"
                  style={{ width: `${Math.min(100, step.progress)}%` }}
                />
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
