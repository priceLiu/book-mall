"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Loader2, X, XCircle } from "lucide-react";
import {
  clearWizardAssetProgress,
  subscribeWizardAssetProgress,
  type WizardAssetProgressState,
  wizardAssetProgressRunningCount,
} from "@/lib/canvas/pro2-wizard-asset-progress";
import { WIZARD_ASSET_KIND_LABEL } from "@/lib/canvas/pro2-production-wizard-assets";
import { WIZARD_SHOT_MEDIA_LABEL } from "@/lib/canvas/pro2-production-wizard-shot-drafts";
import type { WizardProgressKind } from "@/lib/canvas/pro2-wizard-asset-progress";
import { cn } from "@/lib/utils";

function progressKindPrefix(kind: WizardProgressKind): string {
  if (kind === "frame" || kind === "video") {
    return WIZARD_SHOT_MEDIA_LABEL[kind];
  }
  return WIZARD_ASSET_KIND_LABEL[kind];
}

function statusIcon(status: WizardAssetProgressState["items"][number]["status"]) {
  if (status === "running") {
    return <Loader2 className="size-3.5 shrink-0 animate-spin text-violet-300" />;
  }
  if (status === "succeeded") {
    return <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />;
  }
  return <XCircle className="size-3.5 shrink-0 text-amber-400" />;
}

export function Pro2ProductionWizardAssetProgressPanel({
  mounted,
}: {
  mounted: boolean;
}) {
  const [state, setState] = useState<WizardAssetProgressState>({
    open: false,
    items: [],
  });

  useEffect(() => subscribeWizardAssetProgress(setState), []);

  if (!mounted || !state.open || state.items.length === 0) return null;

  const running = wizardAssetProgressRunningCount(state);

  return createPortal(
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[1200] w-[min(320px,calc(100vw-2rem))]"
      role="status"
      aria-live="polite"
      aria-label="生成进度"
    >
      <div className="pointer-events-auto rounded-xl border border-white/10 bg-[#1c1c1e]/96 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2">
          <p className="text-[11px] font-medium text-white/90">
            生成进度
            {running > 0 ? ` · ${running} 进行中` : ""}
          </p>
          {running === 0 ? (
            <button
              type="button"
              className="rounded p-0.5 text-white/45 transition hover:bg-white/10 hover:text-white/80"
              aria-label="关闭"
              onClick={() => clearWizardAssetProgress()}
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        <ul className="max-h-[min(40vh,240px)] overflow-y-auto px-2 py-2">
          {state.items.map((item) => (
            <li
              key={item.jobId}
              className="flex items-start gap-2 rounded-lg px-2 py-1.5"
            >
              {statusIcon(item.status)}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium text-zinc-100">
                  {item.kind === "frame" || item.kind === "video"
                    ? item.label
                    : `${progressKindPrefix(item.kind)} · ${item.label}`}
                </p>
                <p
                  className={cn(
                    "truncate text-[10px]",
                    item.status === "failed"
                      ? "text-amber-300/90"
                      : "text-zinc-500",
                  )}
                >
                  {item.status === "running"
                    ? "生成中…"
                    : item.status === "succeeded"
                      ? "已完成"
                      : item.detail ?? "失败"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
