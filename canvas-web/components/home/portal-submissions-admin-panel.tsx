"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  listPortalSubmissions,
  reviewPortalSubmission,
  type CanvasPortalPublishKind,
  type PortalSubmissionRecord,
} from "@/lib/canvas-api";

const KIND_LABELS: Record<CanvasPortalPublishKind, string> = {
  CASE: "案例",
  FEATURED: "精选",
  PUBLIC_TEMPLATE: "社区模板",
  TEMPLATE: "私有模板",
};

export function PortalSubmissionsAdminPanel() {
  const base = useBookMallBaseUrl();
  const [rows, setRows] = useState<PortalSubmissionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [approveKinds, setApproveKinds] = useState<Record<string, CanvasPortalPublishKind>>({});

  const load = useCallback(async () => {
    if (!base?.trim()) return;
    setLoading(true);
    try {
      const list = await listPortalSubmissions(base, "PENDING");
      setRows(list);
      setApproveKinds((prev) => {
        const next = { ...prev };
        for (const row of list) {
          if (!next[row.id]) next[row.id] = row.requestKind;
        }
        return next;
      });
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (id: string, approve: boolean) => {
    if (!base?.trim()) return;
    setActingId(id);
    try {
      await reviewPortalSubmission(base, id, {
        approve,
        approvedKind: approve ? approveKinds[id] : undefined,
      });
      await load();
    } finally {
      setActingId(null);
    }
  };

  if (loading && rows.length === 0) return null;
  if (rows.length === 0) return null;

  return (
    <div className="mb-6 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3">
      <p className="text-sm font-medium text-amber-100">
        待审核作品（{rows.length}）
      </p>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2"
          >
            <div className="min-w-0 text-sm">
              <span className="font-medium text-white">{row.project.name}</span>
              <span className="mx-2 text-[var(--canvas-muted)]">·</span>
              <span className="text-[var(--canvas-muted)]">
                {row.user.name || row.user.email} · 申请 {KIND_LABELS[row.requestKind]}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={approveKinds[row.id] ?? row.requestKind}
                onChange={(e) =>
                  setApproveKinds((prev) => ({
                    ...prev,
                    [row.id]: e.target.value as CanvasPortalPublishKind,
                  }))
                }
                className="rounded-md border border-white/15 bg-black/30 px-2 py-1 text-xs text-white"
                aria-label="通过后发布为"
              >
                {(Object.keys(KIND_LABELS) as CanvasPortalPublishKind[]).map((kind) => (
                  <option key={kind} value={kind}>
                    发布为 {KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={actingId === row.id}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-400/40 px-2 py-1 text-xs text-emerald-200"
                onClick={() => void review(row.id, true)}
              >
                {actingId === row.id ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Check className="size-3" />
                )}
                通过
              </button>
              <button
                type="button"
                disabled={actingId === row.id}
                className="inline-flex items-center gap-1 rounded-md border border-red-400/40 px-2 py-1 text-xs text-red-200"
                onClick={() => void review(row.id, false)}
              >
                <X className="size-3" />
                驳回
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
