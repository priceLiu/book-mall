"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  copyTextToClipboard,
  extractLogResultUrls,
  formatLogResultText,
  isImageResultUrl,
  isVideoResultUrl,
  pickLogPreviewUrl,
  pickLogProgressLabel,
  pickLogResultPreviewText,
} from "@/lib/gateway-log-params";

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4 11V3.5A1.5 1.5 0 0 1 5.5 2H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="5.5" cy="6.5" r="1" fill="currentColor" />
      <path d="M3 12l3.5-3 2 2L11 8l2 4H3z" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

export function LogResultCell({
  status,
  resultSummary,
}: {
  status: string;
  resultSummary: unknown;
}) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const urls = extractLogResultUrls(resultSummary);
  const previewUrl = pickLogPreviewUrl(resultSummary);
  const previewText = pickLogResultPreviewText(resultSummary);
  const resultText = formatLogResultText(resultSummary);
  const copyText = previewUrl ?? previewText ?? resultText;
  const hasResult =
    status === "SUCCEEDED" &&
    (previewUrl != null || previewText != null || resultText.length > 0);
  const isInProgress = status === "RUNNING" || status === "PENDING";
  const progressLabel = isInProgress
    ? pickLogProgressLabel(status, resultSummary)
    : null;

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
    if (!hasResult) return;
    clearHideTimer();
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(420, window.innerWidth - 32);
    let left = rect.left - width - 14;
    if (left < 16) left = Math.min(rect.right + 14, window.innerWidth - width - 16);
    const top = Math.min(rect.top, window.innerHeight - 680);
    setPos({ top: Math.max(12, top), left: Math.max(12, left) });
    setOpen(true);
  }, [clearHideTimer, hasResult]);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  const onCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!copyText) return;
      const ok = await copyTextToClipboard(copyText);
      if (ok) {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }
    },
    [copyText],
  );

  if (isInProgress) {
    return (
      <span
        className="inline-flex max-w-[140px] items-center gap-1.5 text-[11px] text-[var(--gw-accent)]/85"
        title={progressLabel ?? "任务进行中"}
      >
        <svg
          className="size-3.5 shrink-0 animate-spin text-[var(--gw-accent)]/90"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span className="truncate lowercase">{progressLabel ?? "running"}</span>
      </span>
    );
  }

  if (!hasResult) {
    return <span className="text-[var(--gw-muted)]">—</span>;
  }

  const previewIsImage = previewUrl ? isImageResultUrl(previewUrl) : false;
  const previewIsVideo = previewUrl ? isVideoResultUrl(previewUrl) : false;

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          ref={btnRef}
          type="button"
          onMouseEnter={showTip}
          onMouseLeave={scheduleHide}
          onClick={() => {
            if (previewUrl) {
              window.open(previewUrl, "_blank", "noopener,noreferrer");
            }
          }}
          className="gw-btn-xs inline-flex items-center gap-1.5"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          Result
        </button>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--gw-border)] text-[var(--gw-muted)] transition hover:bg-white/10 hover:text-[var(--gw-ink)]"
          title={copied ? "已复制" : "复制结果"}
        >
          <CopyIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              className="gw-log-preview-tip"
              style={{ top: pos.top, left: pos.left, width: "min(420px, calc(100vw - 32px))" }}
              onMouseEnter={() => {
                clearHideTimer();
                setOpen(true);
              }}
              onMouseLeave={scheduleHide}
              role="dialog"
              aria-label="Result Preview"
            >
              <div className="border-b border-[var(--gw-border)] px-4 py-3 text-sm font-semibold text-[var(--gw-ink)]">
                Result Preview:
              </div>
              <div className="gw-log-preview-tip__body">
                {previewIsImage && previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Result preview"
                    className="max-h-[520px] w-full rounded-md object-contain bg-black/40"
                  />
                ) : previewIsVideo && previewUrl ? (
                  <video
                    src={previewUrl}
                    controls
                    muted
                    className="max-h-[520px] w-full rounded-md bg-black/40"
                  />
                ) : previewText ? (
                  <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-[var(--gw-ink)]">
                    {previewText.length > 8000
                      ? `${previewText.slice(0, 7997)}…`
                      : previewText}
                  </pre>
                ) : previewUrl ? (
                  <p className="break-all font-mono text-[11px] text-[var(--gw-muted)]">{previewUrl}</p>
                ) : (
                  <pre className="whitespace-pre-wrap break-all font-mono text-[11px] text-[var(--gw-muted)]">
                    {resultText.slice(0, 8000)}
                  </pre>
                )}
              </div>
              <div className="gw-log-preview-tip__footer">
                <button
                  type="button"
                  onClick={(e) => void onCopy(e)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--gw-muted)] transition hover:bg-white/10 hover:text-[var(--gw-ink)]"
                  title={copied ? "已复制" : "复制结果"}
                >
                  <CopyIcon className="h-4 w-4" />
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
