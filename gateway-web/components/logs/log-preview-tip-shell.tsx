"use client";

import { copyTextToClipboard } from "@/lib/gateway-log-params";

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4 11V3.5A1.5 1.5 0 0 1 5.5 2H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/** 预览层内容壳（外层由单元格 fixed 定位，无 portal / Context） */
export function LogPreviewTipShell({
  title,
  children,
  copyText,
}: {
  title: string;
  children: React.ReactNode;
  copyText?: string;
}) {
  return (
    <>
      <div className="border-b border-[var(--gw-border)] px-4 py-3 text-sm font-semibold text-[var(--gw-ink)]">
        {title}
      </div>
      <div className="gw-log-preview-tip__body">{children}</div>
      {copyText ? (
        <div className="gw-log-preview-tip__footer">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void copyTextToClipboard(copyText);
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--gw-muted)] transition hover:bg-white/10 hover:text-[var(--gw-ink)]"
            title="复制"
          >
            <CopyIcon className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </>
  );
}
