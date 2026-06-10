"use client";

import { useCallback, useEffect, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { FinancePageShell, FinancePageState } from "@/components/finance-page-shell";
import { PlanChangeSimulationPanel } from "@/components/admin/plan-change-simulation-panel";
import { financeApiFetch } from "@/lib/finance-viewer";
import { canCreateProposal, canFinalApprove, canFinanceReview } from "@/lib/permissions";

type Proposal = {
  id: string;
  title: string;
  status: string;
  marginPassed: boolean;
  createdAt: string;
  simulation: unknown;
  reverseCheck: unknown;
  rejectedReason: string | null;
  events: { toStatus: string; actorRole: string | null; note: string | null; createdAt: string }[];
};

const STATUS: Record<string, string> = {
  DRAFT: "草稿",
  SIMULATED: "已测算",
  FINANCE_REVIEW: "财务复核中",
  APPROVED: "待生效",
  REJECTED: "已驳回",
  EFFECTIVE: "已生效",
  CANCELLED: "已撤销",
};

export function PlanChangeFinanceClient() {
  const base = useBookMallBaseUrl();
  const [role, setRole] = useState<string>("USER");
  const [canViewCost, setCanViewCost] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!base) return;
    financeApiFetch<{ proposals: Proposal[]; canViewCost: boolean }>(base, "/api/finance/plan-change").then(
      (r) => {
        if (r.ok) {
          setProposals(r.data.proposals);
          setCanViewCost(r.data.canViewCost);
          if (!expanded && r.data.proposals[0]) setExpanded(r.data.proposals[0].id);
        } else setError(r.error);
      },
    );
  }, [base, expanded]);

  useEffect(() => {
    if (!base) return;
    import("@/lib/finance-viewer").then(({ fetchFinanceViewer }) =>
      fetchFinanceViewer(base).then((v) => {
        if (v) setRole(v.user.role);
        reload();
      }),
    );
  }, [base, reload]);

  const act = async (body: Record<string, unknown>) => {
    if (!base) return;
    setPending(true);
    setError(null);
    const r = await financeApiFetch<{ ok: boolean; error?: string }>(base, "/api/finance/plan-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setPending(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    if (!r.data.ok) {
      setError(r.data.error ?? "操作失败");
      return;
    }
    reload();
  };

  const canCreate = canCreateProposal(role);
  const canReview = canFinanceReview(role);
  const canFinal = canFinalApprove(role);

  return (
    <FinancePageShell>
      <header>
        <h1 className="text-lg font-medium text-[#262626]">调价测算与审批</h1>
        <p className="mt-1 text-sm text-[#8c8c8c]">
          财务 2.0 · 六维测算预演 + 反向验算 + 审批流（运营提交 → 财务复核 → 超管终审）。
        </p>
      </header>

      {error ? <p className="rounded bg-[#fff1f0] px-3 py-2 text-sm text-[#cf1322]">{error}</p> : null}

      {canCreate ? (
        <form
          className="grid gap-3 rounded border border-[#e8e8e8] bg-white p-4 md:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void act({
              action: "createAndSimulate",
              title: fd.get("title"),
              model: fd.get("model") || undefined,
              videoMarginM: fd.get("videoMarginM") ? Number(fd.get("videoMarginM")) : undefined,
              guard: fd.get("guard") ? Number(fd.get("guard")) : undefined,
            });
          }}
        >
          <div className="md:col-span-2">
            <label className="text-xs text-[#8c8c8c]">提案标题</label>
            <input name="title" required className="mt-1 w-full rounded border px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs text-[#8c8c8c]">模型 key</label>
            <input name="model" placeholder="happyhorse-r2v" className="mt-1 w-full rounded border px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs text-[#8c8c8c]">视频 M</label>
            <input name="videoMarginM" type="number" step="0.1" placeholder="4" className="mt-1 w-full rounded border px-2 py-1.5 text-sm" />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded bg-[#1890ff] px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              创建并测算
            </button>
          </div>
        </form>
      ) : null}

      <ul className="space-y-3">
        {proposals.map((p) => {
          const open = expanded === p.id;
          const sim = p.simulation as Parameters<typeof PlanChangeSimulationPanel>[0]["simulation"] | null;
          const reverse = (p.reverseCheck ?? null) as Parameters<
            typeof PlanChangeSimulationPanel
          >[0]["reverseCheck"];
          return (
            <li key={p.id} className="rounded border border-[#e8e8e8] bg-white">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm"
                onClick={() => setExpanded(open ? null : p.id)}
              >
                <span className="font-medium">{p.title}</span>
                <span className="flex items-center gap-2 text-xs text-[#8c8c8c]">
                  {STATUS[p.status] ?? p.status}
                  {p.marginPassed ? (
                    <span className="text-[#389e0d]">护栏通过</span>
                  ) : (
                    <span className="text-[#cf1322]">护栏未过</span>
                  )}
                </span>
              </button>
              {open ? (
                <div className="border-t border-[#f0f0f0] px-4 py-3 text-sm">
                  {canViewCost && sim ? (
                    <div className="mb-3">
                      <PlanChangeSimulationPanel simulation={sim} reverseCheck={reverse} />
                    </div>
                  ) : (
                    <p className="mb-2 text-xs text-[#8c8c8c]">测算明细仅财务/超管可见。</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {canCreate && ["SIMULATED", "DRAFT"].includes(p.status) ? (
                      <>
                        <ActionBtn disabled={pending} onClick={() => act({ action: "reSimulate", id: p.id })}>
                          重新测算
                        </ActionBtn>
                        <ActionBtn
                          disabled={pending || !p.marginPassed}
                          onClick={() => act({ action: "submitForReview", id: p.id })}
                        >
                          提交财务复核
                        </ActionBtn>
                      </>
                    ) : null}
                    {canReview && p.status === "FINANCE_REVIEW" ? (
                      <>
                        <ActionBtn disabled={pending} onClick={() => act({ action: "financeApprove", id: p.id })}>
                          财务通过
                        </ActionBtn>
                        <ActionBtn disabled={pending} onClick={() => act({ action: "financeReject", id: p.id, note: "驳回" })}>
                          驳回
                        </ActionBtn>
                      </>
                    ) : null}
                    {canFinal && p.status === "APPROVED" ? (
                      <ActionBtn disabled={pending} onClick={() => act({ action: "finalApprove", id: p.id })}>
                        终审生效
                      </ActionBtn>
                    ) : null}
                    {canCreate && !["EFFECTIVE", "CANCELLED"].includes(p.status) ? (
                      <ActionBtn disabled={pending} onClick={() => act({ action: "cancel", id: p.id })}>
                        撤销
                      </ActionBtn>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </FinancePageShell>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded border border-[#d9d9d9] px-2 py-1 text-xs hover:border-[#1890ff] disabled:opacity-50"
    >
      {children}
    </button>
  );
}
