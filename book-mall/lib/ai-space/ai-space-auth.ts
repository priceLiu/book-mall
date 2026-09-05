/**
 * 我的 AI 空间 · 双模鉴权
 *
 * - 同域个人中心（`/account/ai-space`）用 NextAuth session
 * - 子应用经 SSO 后用 `Authorization: Bearer {tools_token}`
 *
 * 两条路径都落到同一个 { userId, tenantCtx }，业务层不再关心来源。
 */

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";
import {
  getActiveTenantContext,
  resolveTenantContextForUser,
  type TenantContext,
} from "@/lib/tenant/context";

export type AiSpaceActor = {
  userId: string;
  tenantCtx: TenantContext | null;
  /** session = 个人中心同域；bearer = 子应用 */
  via: "session" | "bearer";
};

export type AiSpaceActorResult =
  | { ok: true; actor: AiSpaceActor }
  | { ok: false; res: NextResponse };

/**
 * 仅校验登录身份（Bearer / NextAuth），不查租户表。
 * 适用于 MiniMax 系统音色 manifest 等静态目录，避免 DB 抖动导致 500。
 */
export async function resolveAiSpaceIdentity(
  req: Request,
): Promise<
  | { ok: true; userId: string; via: "session" | "bearer" }
  | { ok: false; res: NextResponse }
> {
  const hasBearer = (req.headers.get("authorization") ?? "").startsWith("Bearer ");

  if (hasBearer) {
    const v = verifyToolsBearer(req);
    if (!v.ok) return { ok: false, res: v.res };
    return { ok: true, userId: v.userId, via: "bearer" };
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return {
      ok: false,
      res: NextResponse.json({ error: "未登录" }, { status: 401 }),
    };
  }
  return { ok: true, userId, via: "session" };
}

/**
 * 解析调用者。有 Authorization 头时走 Bearer，否则回落 NextAuth session。
 */
export async function resolveAiSpaceActor(
  req: Request,
): Promise<AiSpaceActorResult> {
  const hasBearer = (req.headers.get("authorization") ?? "").startsWith("Bearer ");

  if (hasBearer) {
    const v = verifyToolsBearer(req);
    if (!v.ok) return { ok: false, res: v.res };
    const tenantCtx = await resolveTenantContextForUser(
      v.userId,
      v.preferredTenantId ?? null,
    );
    return { ok: true, actor: { userId: v.userId, tenantCtx, via: "bearer" } };
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return {
      ok: false,
      res: NextResponse.json({ error: "未登录" }, { status: 401 }),
    };
  }
  const tenantCtx = await getActiveTenantContext(userId);
  return { ok: true, actor: { userId, tenantCtx, via: "session" } };
}
