"use client";

import { useState } from "react";

import { IconEye, IconEyeOff } from "@/components/icons";
import { copyTextToClipboard } from "@/lib/clipboard";
import type { CredentialRow } from "./types";

type RevealResponse = {
  apiKey?: string;
  volcengine?: {
    arkApiKey: string | null;
    accessKeyId: string | null;
    secretAccessKey: string | null;
  };
  error?: string;
};

function KeyLine({
  label,
  masked,
  revealed,
  onToggle,
  loading,
}: {
  label: string;
  masked: string;
  revealed: string | null;
  onToggle: () => void;
  loading: boolean;
}) {
  const display = revealed ?? masked;
  const isRevealed = Boolean(revealed);

  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-1.5">
      <span className="text-[10px] text-[var(--gw-muted)]">{label}</span>
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
        onClick={onToggle}
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
    </span>
  );
}

export function CredentialKeyReveal({
  credentialId,
  masked,
  credential,
}: {
  credentialId: string;
  masked: string;
  credential?: Pick<
    CredentialRow,
    "providerKind" | "volcengineHasPortraitIam" | "volcenginePortraitAccessKeyMasked"
  >;
}) {
  const [revealed, setRevealed] = useState<RevealResponse["volcengine"] | string | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isVolcengine = credential?.providerKind === "VOLCENGINE";
  const portraitMasked = credential?.volcenginePortraitAccessKeyMasked;
  const hasPortrait = credential?.volcengineHasPortraitIam === true;

  const fetchReveal = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/book-mall/api/gateway/credentials/reveal?id=${encodeURIComponent(credentialId)}`,
      );
      const data = (await res.json().catch(() => null)) as RevealResponse | null;
      if (!res.ok || !data?.apiKey) {
        setError(data?.error ?? "无法读取 Key");
        return null;
      }
      if (data.volcengine) {
        setRevealed(data.volcengine);
        return data.volcengine;
      }
      setRevealed(data.apiKey);
      return data.apiKey;
    } finally {
      setLoading(false);
    }
  };

  const hide = () => {
    setRevealed(null);
    setError(null);
  };

  if (isVolcengine) {
    const volc =
      revealed && typeof revealed === "object" ? revealed : null;
    const arkRevealed = volc?.arkApiKey ?? null;
    const iamRevealed = volc?.accessKeyId ?? null;

    return (
      <div className="flex flex-col gap-1">
        <KeyLine
          label="ARK"
          masked={masked}
          revealed={arkRevealed}
          loading={loading}
          onToggle={() => {
            if (arkRevealed) hide();
            else void fetchReveal();
          }}
        />
        {hasPortrait && portraitMasked ? (
          <KeyLine
            label="IAM"
            masked={portraitMasked}
            revealed={iamRevealed}
            loading={loading}
            onToggle={() => {
              if (iamRevealed) hide();
              else void fetchReveal();
            }}
          />
        ) : (
          <span className="text-[10px] text-amber-300/90">未配置人像 IAM</span>
        )}
        {error ? <span className="text-[10px] text-red-400">{error}</span> : null}
      </div>
    );
  }

  const display =
    typeof revealed === "string" ? revealed : (revealed ?? masked);
  const isRevealed = typeof revealed === "string";

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
        onClick={() => {
          if (isRevealed) hide();
          else void fetchReveal();
        }}
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
          onClick={() => void copyTextToClipboard(revealed as string)}
        >
          复制
        </button>
      ) : null}
      {error ? <span className="text-[10px] text-red-400">{error}</span> : null}
    </span>
  );
}
