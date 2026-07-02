"use client";

import { useState } from "react";

import { IconEye, IconEyeOff } from "@/components/icons";
import { copyTextToClipboard } from "@/lib/clipboard";

export function CredentialKeyReveal({
  credentialId,
  masked,
}: {
  credentialId: string;
  masked: string;
}) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const display = revealed ?? masked;
  const isRevealed = Boolean(revealed);

  const toggle = async () => {
    if (isRevealed) {
      setRevealed(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/book-mall/api/gateway/credentials/reveal?id=${encodeURIComponent(credentialId)}`,
      );
      const data = (await res.json().catch(() => null)) as {
        apiKey?: string;
        error?: string;
      } | null;
      if (!res.ok || !data?.apiKey) {
        setError(data?.error ?? "无法读取 Key");
        return;
      }
      setRevealed(data.apiKey);
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className="inline-flex max-w-full items-center gap-1.5">
      <span
        className={`font-mono text-xs break-all ${isRevealed ? "text-[var(--gw-ink)]" : "text-[var(--gw-muted)]"}`}
        title={isRevealed ? "完整 Key" : masked}
      >
        {display}
      </span>
      <button
        type="button"
        className="shrink-0 rounded p-0.5 text-[var(--gw-muted)] hover:bg-white/10 hover:text-[var(--gw-ink)] disabled:opacity-50"
        title={isRevealed ? "隐藏 Key" : "查看完整 Key"}
        disabled={loading}
        onClick={() => void toggle()}
      >
        {loading ? (
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent" />
        ) : isRevealed ? (
          <IconEyeOff className="h-3.5 w-3.5" />
        ) : (
          <IconEye className="h-3.5 w-3.5" />
        )}
      </button>
      {isRevealed ? (
        <button
          type="button"
          className="shrink-0 text-[10px] text-[var(--gw-accent)] hover:underline"
          onClick={() => void copyTextToClipboard(revealed!)}
        >
          复制
        </button>
      ) : null}
      {error ? <span className="text-[10px] text-red-400">{error}</span> : null}
    </span>
  );
}
