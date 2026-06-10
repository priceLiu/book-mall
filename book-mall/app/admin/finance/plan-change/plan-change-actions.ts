"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  canCreateProposal,
  canFinalApprove,
  canFinanceReview,
} from "@/lib/auth/permissions";
import {
  createProposal,
  runSimulation,
  transitionProposal,
  type ProposalPayload,
} from "@/lib/pricing/plan-change-service";
import type { ActionResult } from "@/lib/server-action-result";

async function session() {
  const s = await getServerSession(authOptions);
  return s?.user?.id ? { id: s.user.id, role: s.user.role } : null;
}

function num(v: FormDataEntryValue | null): number | undefined {
  if (v == null || v.toString().trim() === "") return undefined;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : undefined;
}
function str(v: FormDataEntryValue | null): string {
  return (v?.toString() ?? "").trim();
}

const PATH = "/admin/finance/plan-change";

/** 运营/财务/超管：创建提案并立即测算。 */
export async function createAndSimulateAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const s = await session();
  if (!s || !canCreateProposal(s.role)) return { ok: false, error: "需要运营及以上权限" };

  const title = str(formData.get("title"));
  if (!title) return { ok: false, error: "请填写提案标题" };
  const payload: ProposalPayload = {
    model: str(formData.get("model")) || undefined,
    videoMarginM: num(formData.get("videoMarginM")),
    guard: num(formData.get("guard")),
    targetMargin: num(formData.get("targetMargin")),
  };
  try {
    const proposal = await createProposal({ title, payload, createdBy: s.id, actorRole: s.role });
    await runSimulation({ proposalId: proposal.id, actorId: s.id, actorRole: s.role });
    revalidatePath(PATH);
    return { ok: true, data: { id: proposal.id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "创建失败" };
  }
}

export async function reSimulateAction(formData: FormData): Promise<ActionResult> {
  const s = await session();
  if (!s || !canCreateProposal(s.role)) return { ok: false, error: "需要运营及以上权限" };
  const id = str(formData.get("id"));
  if (!id) return { ok: false, error: "缺少提案 id" };
  try {
    await runSimulation({ proposalId: id, actorId: s.id, actorRole: s.role });
    revalidatePath(PATH);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "测算失败" };
  }
}

export async function submitForReviewAction(formData: FormData): Promise<ActionResult> {
  const s = await session();
  if (!s || !canCreateProposal(s.role)) return { ok: false, error: "需要运营及以上权限" };
  const id = str(formData.get("id"));
  try {
    await transitionProposal({ proposalId: id, to: "FINANCE_REVIEW", actorId: s.id, actorRole: s.role, note: "提交财务复核" });
    revalidatePath(PATH);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "提交失败" };
  }
}

export async function financeApproveAction(formData: FormData): Promise<ActionResult> {
  const s = await session();
  if (!s || !canFinanceReview(s.role)) return { ok: false, error: "需要财务/超管权限" };
  const id = str(formData.get("id"));
  try {
    await transitionProposal({ proposalId: id, to: "APPROVED", actorId: s.id, actorRole: s.role, note: "财务复核通过" });
    revalidatePath(PATH);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "复核失败" };
  }
}

export async function financeRejectAction(formData: FormData): Promise<ActionResult> {
  const s = await session();
  if (!s || !canFinanceReview(s.role)) return { ok: false, error: "需要财务/超管权限" };
  const id = str(formData.get("id"));
  const reason = str(formData.get("reason")) || "财务复核驳回";
  try {
    await transitionProposal({ proposalId: id, to: "REJECTED", actorId: s.id, actorRole: s.role, rejectedReason: reason, note: reason });
    revalidatePath(PATH);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "驳回失败" };
  }
}

export async function finalApproveAction(formData: FormData): Promise<ActionResult> {
  const s = await session();
  if (!s || !canFinalApprove(s.role)) return { ok: false, error: "需要超管权限" };
  const id = str(formData.get("id"));
  try {
    await transitionProposal({ proposalId: id, to: "EFFECTIVE", actorId: s.id, actorRole: s.role, note: "超管终审生效" });
    revalidatePath(PATH);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "终审失败" };
  }
}

export async function cancelProposalAction(formData: FormData): Promise<ActionResult> {
  const s = await session();
  if (!s || !canCreateProposal(s.role)) return { ok: false, error: "需要运营及以上权限" };
  const id = str(formData.get("id"));
  try {
    await transitionProposal({ proposalId: id, to: "CANCELLED", actorId: s.id, actorRole: s.role, note: "撤销提案" });
    revalidatePath(PATH);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "撤销失败" };
  }
}
