"use client";

import { useCallback, useState } from "react";

export function CopyLogIdButton({
  value,
  label,
  emptyLabel = "—",
}: {
  value?: string | null;
  label: string;
  emptyLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const trimmed = value?.trim();

  const onCopy = useCallback(async () => {
    if (!trimmed) return;
    try {
      await navigator.clipboard.writeText(trimmed);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }, [trimmed]);

  if (!trimmed) {
    return (
      <span className="text-[var(--gw-muted)]" title="提交阶段失败时通常无 Vendor Task ID，请复制 Request ID">
        {emptyLabel}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      className="group inline-flex max-w-full items-center gap-1 font-mono text-xs text-[var(--gw-accent)] hover:underline"
      title={`复制 ${label}`}
    >
      <span className="truncate">{trimmed.slice(0, 14)}{trimmed.length > 14 ? "…" : ""}</span>
      <span className="shrink-0 text-[10px] text-[var(--gw-muted)] group-hover:text-[var(--gw-accent)]">
        {copied ? "已复制" : "复制"}
      </span>
    </button>
  );
}
