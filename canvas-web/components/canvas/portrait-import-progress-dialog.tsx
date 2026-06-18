"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Circle, Loader2, XCircle } from "lucide-react";
import {
  closePortraitImportProgress,
  portraitImportProgressPercent,
  portraitImportProgressTitle,
  subscribePortraitImportProgress,
  type PortraitImportProgressState,
  type PortraitImportStep,
} from "@/lib/canvas/portrait-import-progress";
import { cn } from "@/lib/utils";

function StepIcon({ status }: { status: PortraitImportStep["status"] }) {
  if (status === "running") {
    return <Loader2 className="size-4 shrink-0 animate-spin text-cyan-300" />;
  }
  if (status === "success") {
    return <Check className="size-4 shrink-0 text-emerald-400" />;
  }
  if (status === "error") {
    return <XCircle className="size-4 shrink-0 text-rose-400" />;
  }
  if (status === "skipped") {
    return <Circle className="size-4 shrink-0 text-white/25" />;
  }
  return <Circle className="size-4 shrink-0 text-white/20" />;
}

function StepRow({
  index,
  label,
  sub,
  step,
}: {
  index: number;
  label: string;
  sub: string;
  step: PortraitImportStep;
}) {
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center pt-0.5">
        <StepIcon status={step.status} />
        {index === 1 ? (
          <div
            className={cn(
              "mt-1 w-px flex-1 min-h-[28px]",
              step.status === "success" ? "bg-emerald-500/40" : "bg-white/10",
            )}
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1 pb-4">
        <p className="text-[13px] font-medium text-white/90">
          步骤 {index} · {label}
        </p>
        <p className="text-[11px] text-white/40">{sub}</p>
        {step.detail ? (
          <p
            className={cn(
              "mt-1 break-all text-[11px] leading-snug",
              step.status === "error" ? "text-rose-200/90" : "text-white/55",
            )}
          >
            {step.detail}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function PortraitImportProgressModal({
  state,
}: {
  state: PortraitImportProgressState;
}) {
  const pct = portraitImportProgressPercent(state);
  const title = portraitImportProgressTitle(state);

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1c1c1e] p-5 shadow-2xl"
        role="dialog"
        aria-modal
        aria-labelledby="portrait-import-progress-title"
      >
        <h2
          id="portrait-import-progress-title"
          className="text-base font-semibold text-white"
        >
          {title}
        </h2>
        <p className="mt-1 text-xs text-white/45">
          入库分两步：火山私域库（生视频引用）与项目资产私域人像库（复用插入）。
        </p>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              state.canClose && state.projectAsset.status === "error"
                ? "bg-amber-400/90"
                : "bg-cyan-400/90",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1 text-right text-[10px] tabular-nums text-white/35">
          {pct}%
        </p>

        <ol className="mt-3 list-none">
          <StepRow
            index={1}
            label="火山私域人像库"
            sub="Volcengine Assets · asset://"
            step={state.volcengine}
          />
          <StepRow
            index={2}
            label="项目资产 · 私域人像库"
            sub="本站项目资产 · 插入画布复用"
            step={state.projectAsset}
          />
        </ol>

        {state.canClose ? (
          <div className="mt-1 flex justify-end">
            <button
              type="button"
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
              onClick={() => closePortraitImportProgress()}
            >
              我知道了
            </button>
          </div>
        ) : (
          <p className="mt-2 text-center text-[11px] text-white/35">
            请勿关闭页面…
          </p>
        )}
      </div>
    </div>
  );
}

export function PortraitImportProgressHost() {
  const [state, setState] = useState<PortraitImportProgressState>(() => ({
    open: false,
    canClose: false,
    volcengine: { status: "pending" },
    projectAsset: { status: "pending" },
  }));

  useEffect(() => subscribePortraitImportProgress(setState), []);

  if (!state.open || typeof document === "undefined") return null;
  return createPortal(
    <PortraitImportProgressModal state={state} />,
    document.body,
  );
}
