"use client";

import { useCallback, useRef, useState, memo, useMemo } from "react";
import {
  copyTextToClipboard,
  formatLogParamsView,
} from "@/lib/gateway-log-params";
import { LogHoverTipLayer } from "./log-hover-tip-layer";
import { useLogHoverTip } from "./use-log-hover-tip";

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4 11V3.5A1.5 1.5 0 0 1 5.5 2H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function ParamsFormattedBody({
  inputFullJson,
  model,
}: {
  inputFullJson: string;
  model: string;
}) {
  return (
    <div className="space-y-3 font-mono text-[12px] leading-[1.6]">
      <div>
        <div className="mb-1 font-sans text-[13px] font-medium text-[var(--gw-ink)]">input:</div>
        <pre className="whitespace-pre-wrap break-all text-[var(--gw-ink)]">{inputFullJson}</pre>
      </div>
      <div className="font-sans text-[13px] text-[var(--gw-ink)]">
        <span className="font-medium text-[var(--gw-ink)]">model:</span> {model}
      </div>
    </div>
  );
}

export const LogParamsCell = memo(function LogParamsCell({
  inputSummary,
}: {
  inputSummary: unknown;
}) {
  const formatted = useMemo(() => formatLogParamsView(inputSummary), [inputSummary]);
  const { inputPreviewLine, inputFullJson, model, copyText } = formatted;
  const [copied, setCopied] = useState(false);
  const [tipCopied, setTipCopied] = useState(false);
  const cellRef = useRef<HTMLDivElement>(null);
  const { open, pos, bindAnchor, bindTip } = useLogHoverTip({
    tipWidth: 720,
    tipMaxH: 680,
  });

  const doCopy = useCallback(
    async (which: "cell" | "tip") => {
      const ok = await copyTextToClipboard(copyText);
      if (!ok) return;
      if (which === "cell") {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      } else {
        setTipCopied(true);
        window.setTimeout(() => setTipCopied(false), 1500);
      }
    },
    [copyText],
  );

  const hover = bindAnchor(() => cellRef.current?.getBoundingClientRect() ?? null);
  const tipHover = bindTip();

  return (
    <>
      <div
        ref={cellRef}
        className="gw-log-params-cell relative"
        onMouseEnter={hover.onMouseEnter}
        onMouseLeave={hover.onMouseLeave}
      >
        <div className="rounded-lg border border-[var(--gw-border)] bg-[var(--gw-surface)] px-3 py-2.5">
          <div className="cursor-default font-mono text-[11px] leading-[1.55]">
            <span className="text-[var(--gw-muted)]">input: </span>
            <span className="break-all text-[var(--gw-ink)]">{inputPreviewLine}</span>
          </div>
          <div className="mt-1.5 font-mono text-[11px] text-[var(--gw-muted)]">
            model: <span className="text-[var(--gw-ink)]">{model}</span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void doCopy("cell");
            }}
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-[var(--gw-muted)] transition hover:text-[var(--gw-ink)]"
            title={copied ? "已复制" : "复制 Params"}
          >
            <CopyIcon className="h-3 w-3" />
            {copied ? "已复制" : "复制"}
          </button>
        </div>
      </div>

      {open && pos ? (
        <LogHoverTipLayer
          open={open}
          pos={pos}
          className="gw-log-preview-tip pointer-events-auto"
          ariaLabel="Params 完整预览"
          tipHover={tipHover}
        >
          <div className="gw-log-preview-tip__body">
            <ParamsFormattedBody inputFullJson={inputFullJson} model={model} />
          </div>
          <div className="gw-log-preview-tip__footer">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void doCopy("tip");
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--gw-muted)] transition hover:bg-white/10 hover:text-[var(--gw-ink)]"
              title={tipCopied ? "已复制" : "复制 Params"}
            >
              <CopyIcon className="h-4 w-4" />
            </button>
          </div>
        </LogHoverTipLayer>
      ) : null}
    </>
  );
});
