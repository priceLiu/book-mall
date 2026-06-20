"use client";

import { useRef } from "react";
import {
  formatRequestStatusShortLabel,
  type LogRequestStatus,
} from "@/lib/gateway-log-display";
import {
  gatewayFailMessageDisplay,
  resolveGatewayFailCodeDisplay,
} from "@/lib/gateway-log-fail";
import { LogPreviewTipShell } from "./log-preview-tip-shell";
import { useLogHoverTip } from "./use-log-hover-tip";

function normalizeStatus(status: string): LogRequestStatus {
  return status.toUpperCase() as LogRequestStatus;
}

function statusDotColor(status: LogRequestStatus): string {
  switch (normalizeStatus(status)) {
    case "SUCCEEDED":
      return "#22c55e";
    case "FAILED":
      return "#ef4444";
    case "RUNNING":
      return "#f97316";
    case "PENDING":
      return "#eab308";
    case "CANCELLED":
      return "#71717a";
    default:
      return "#a1a1aa";
  }
}

export function LogStatusBadge({
  status,
  failCode,
  failMessage,
  progressLabel,
}: {
  status: LogRequestStatus;
  failCode?: string | null;
  failMessage?: string | null;
  progressLabel?: string | null;
}) {
  const normalized = normalizeStatus(status);
  const isActive = normalized === "RUNNING" || normalized === "PENDING";
  const dotColor = statusDotColor(status);
  const anchorRef = useRef<HTMLSpanElement>(null);

  const isFailed = normalized === "FAILED";
  const code = resolveGatewayFailCodeDisplay({ failCode, failMessage });
  const message = isFailed
    ? gatewayFailMessageDisplay(failMessage)
    : "";
  const hasFailTip = isFailed;
  const copyText = hasFailTip ? `code: ${code}\n\nmessage: ${message}` : undefined;
  const nativeTitle = hasFailTip ? `${code}: ${message}` : undefined;

  const { open, pos, bindAnchor, bindTip } = useLogHoverTip({
    tipWidth: 520,
    enabled: hasFailTip,
  });

  const anchorHandlers = bindAnchor(() => anchorRef.current?.getBoundingClientRect() ?? null);
  const tipHandlers = bindTip();

  return (
    <>
      <span
        ref={anchorRef}
        title={nativeTitle ?? (isActive && progressLabel ? progressLabel : undefined)}
        className={`inline-flex items-center gap-2 ${
          isActive ? "rounded-md bg-[#2a2a32] px-2.5 py-1" : ""
        } ${hasFailTip ? "cursor-help" : ""}`}
        onMouseEnter={hasFailTip ? anchorHandlers.onMouseEnter : undefined}
        onMouseLeave={hasFailTip ? anchorHandlers.onMouseLeave : undefined}
      >
        <span
          className="inline-block h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: dotColor }}
          aria-hidden
        />
        <span className="text-sm lowercase text-white">
          {formatRequestStatusShortLabel(normalized)}
        </span>
        {isActive && progressLabel ? (
          <span className="max-w-[88px] truncate text-[10px] lowercase text-orange-200/75">
            {progressLabel}
          </span>
        ) : null}
      </span>

      {hasFailTip && open && pos ? (
        <LogPreviewTipShell
          pos={pos}
          title="Failed"
          copyText={copyText}
          ariaLabel="失败原因"
          onEnter={tipHandlers.onMouseEnter}
          onLeave={tipHandlers.onMouseLeave}
        >
          <div className="space-y-3 font-mono text-[12px] leading-[1.6]">
            <div>
              <div className="mb-1 font-sans text-[13px] font-medium text-zinc-200">
                code:
              </div>
              <pre className="whitespace-pre-wrap break-all text-zinc-300">{code}</pre>
            </div>
            <div>
              <div className="mb-1 font-sans text-[13px] font-medium text-zinc-200">
                message:
              </div>
              <pre className="whitespace-pre-wrap break-all text-zinc-300">
                {message}
              </pre>
            </div>
          </div>
        </LogPreviewTipShell>
      ) : null}
    </>
  );
}
