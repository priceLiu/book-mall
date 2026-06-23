"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  copyTextToClipboard,
  formatLogParamsView,
} from "@/lib/gateway-log-params";

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <rect
        x="5"
        y="5"
        width="8"
        height="8"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M4 11V3.5A1.5 1.5 0 0 1 5.5 2H11"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
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
        <div className="mb-1 font-sans text-[13px] font-medium text-[var(--gw-ink)]">
          input:
        </div>
        <pre className="whitespace-pre-wrap break-all text-[var(--gw-ink)]">
          {inputFullJson}
        </pre>
      </div>
      <div className="font-sans text-[13px] text-[var(--gw-ink)]">
        <span className="font-medium text-[var(--gw-ink)]">model:</span> {model}
      </div>
    </div>
  );
}

function ParamsPreviewTip({
  pos,
  inputFullJson,
  model,
  onCopy,
  copied,
  onEnter,
  onLeave,
}: {
  pos: { top: number; left: number };
  inputFullJson: string;
  model: string;
  onCopy: () => void;
  copied: boolean;
  onEnter: () => void;
  onLeave: () => void;
}) {
  return (
    <div
      className="gw-log-preview-tip"
      style={{
        top: pos.top,
        left: pos.left,
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      role="dialog"
      aria-label="Params 完整预览"
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
            onCopy();
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--gw-muted)] transition hover:bg-white/10 hover:text-[var(--gw-ink)]"
          title={copied ? "已复制" : "复制 Params"}
        >
          <CopyIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function LogParamsCell({
  inputSummary,
}: {
  inputSummary: unknown;
}) {
  const { inputPreviewLine, inputFullJson, model, copyText } =
    formatLogParamsView(inputSummary);
  const [copied, setCopied] = useState(false);
  const [tipCopied, setTipCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const cellRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimer.current = setTimeout(() => {
      setOpen(false);
      setPos(null);
    }, 280);
  }, [clearHideTimer]);

  const showTip = useCallback(() => {
    clearHideTimer();
    const el = cellRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(720, window.innerWidth - 32);
    let left = rect.left - width - 14;
    if (left < 16) {
      left = Math.min(rect.right + 14, window.innerWidth - width - 16);
    }
    const tipMaxH = Math.min(680, window.innerHeight - 24);
    const top = Math.min(rect.top, window.innerHeight - tipMaxH);
    setPos({
      top: Math.max(12, top),
      left: Math.max(12, left),
    });
    setOpen(true);
  }, [clearHideTimer]);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  const doCopy = useCallback(async (which: "cell" | "tip") => {
    const ok = await copyTextToClipboard(copyText);
    if (!ok) return;
    if (which === "cell") {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } else {
      setTipCopied(true);
      window.setTimeout(() => setTipCopied(false), 1500);
    }
  }, [copyText]);

  return (
    <>
      <div
        ref={cellRef}
        className="gw-log-params-cell relative"
        onMouseEnter={showTip}
        onMouseLeave={scheduleHide}
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

      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <ParamsPreviewTip
              pos={pos}
              inputFullJson={inputFullJson}
              model={model}
              copied={tipCopied}
              onCopy={() => void doCopy("tip")}
              onEnter={() => {
                clearHideTimer();
                setOpen(true);
              }}
              onLeave={scheduleHide}
            />,
            document.body,
          )
        : null}
    </>
  );
}
