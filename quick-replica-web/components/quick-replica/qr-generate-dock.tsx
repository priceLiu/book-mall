"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, Maximize2, X } from "lucide-react";

import type { QrGenerateModalPhase } from "@/components/quick-replica/qr-generate-preview-modal";
import type { QrGenerateJobResult } from "@/components/quick-replica/qr-workspace-panel";
import { getKindDef, type QrWorkspaceDraft } from "@/lib/qr-template-types";

export type QrGenerateSession = {
  id: string;
  logId: string | null;
  phase: QrGenerateModalPhase;
  result: QrGenerateJobResult | null;
  draft: QrWorkspaceDraft;
  previewImageUrl?: string;
  alreadySaved: boolean;
  minimized: boolean;
  startedAt: number;
};

function formatAge(startedAt: number, now: number): string {
  const sec = Math.max(0, Math.floor((now - startedAt) / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} 分钟`;
  return `${Math.floor(m / 60)} 小时 ${m % 60} 分`;
}

function mediaHint(draft: QrWorkspaceDraft): string {
  if (draft.category === "world") return "场景生成中…";
  if (draft.category === "image" || draft.category === "character") return "图像生成中…";
  if (draft.category === "audio") return "音频生成中…";
  return "视频生成中…";
}

function sessionTitle(session: QrGenerateSession): string {
  return (
    session.draft.title?.trim() ||
    getKindDef(session.draft.kind)?.label ||
    session.draft.kind
  );
}

type Props = {
  sessions: QrGenerateSession[];
  onExpand: (id: string) => void;
  onDismiss: (id: string) => void;
};

export function QrGenerateDock({ sessions, onExpand, onDismiss }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const running = sessions.some((s) => s.phase === "generating");
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  if (!mounted || sessions.length === 0 || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="pointer-events-auto fixed bottom-20 right-4 z-[60] w-[min(100vw-2rem,20rem)] overflow-hidden rounded-xl border shadow-xl lg:bottom-4"
      style={{
        borderColor: "rgba(59,130,246,0.35)",
        background: "var(--qr-bg-elevated)",
        boxShadow: "var(--qr-shadow-brand)",
      }}
    >
      <div
        className="flex items-center justify-between gap-2 px-3 py-2"
        style={{ borderBottom: "1px solid var(--qr-border)" }}
      >
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-[var(--qr-text-primary)]">
          {running ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--qr-brand)]" />
          ) : (
            <Check className="h-4 w-4 shrink-0 text-emerald-300" />
          )}
          <span className="truncate">后台生成 · {sessions.length}</span>
        </span>
      </div>
      <ul className="max-h-72 space-y-2 overflow-y-auto p-2">
        {sessions.map((session) => {
          const generating = session.phase === "generating";
          const failed = session.phase === "failed";
          return (
            <li
              key={session.id}
              className="rounded-lg border px-2 py-2"
              style={{
                borderColor: "var(--qr-border)",
                background: "var(--qr-bg-surface)",
              }}
            >
              <button
                type="button"
                className="flex w-full items-start gap-2 text-left"
                onClick={() => onExpand(session.id)}
              >
                <div className="relative h-12 w-10 shrink-0 overflow-hidden rounded-md bg-black/50">
                  {session.previewImageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={session.previewImageUrl}
                      alt=""
                      className="h-full w-full object-cover opacity-80"
                    />
                  ) : (
                    <div className="h-full w-full bg-[var(--qr-bg-page)]" />
                  )}
                  {generating ? (
                    <div className="qr-generate-sweep pointer-events-none absolute inset-0" />
                  ) : null}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    {generating ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[var(--qr-brand)]" />
                    ) : failed ? (
                      <X className="h-4 w-4 text-red-300" />
                    ) : (
                      <Check className="h-4 w-4 text-emerald-300" />
                    )}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--qr-text-primary)]">
                    {sessionTitle(session)}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-[var(--qr-text-muted)]">
                    {generating
                      ? `${mediaHint(session.draft)} · ${formatAge(session.startedAt, now)}`
                      : failed
                        ? session.result?.error?.trim() || "产生失败"
                        : "已完成 · 点击查看"}
                  </p>
                </div>
                <Maximize2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--qr-text-muted)]" />
              </button>
              {!generating ? (
                <button
                  type="button"
                  className="mt-1.5 text-[11px] text-[var(--qr-text-muted)] hover:text-[var(--qr-text-primary)]"
                  onClick={() => onDismiss(session.id)}
                >
                  关闭
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>,
    document.body,
  );
}

export function newQrGenerateSessionId(): string {
  return `qr-gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
