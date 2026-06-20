import { NextResponse } from "next/server";

import { canViewFinanceCost } from "@/lib/auth/permissions";
import {
  GatewayRequiredError,
  assertGatewayApiKeyLinkedForUser,
} from "@/lib/gateway/book-gateway-link";
import {
  PlatformEntitlementError,
  assertPlatformGatewayEntitlement,
} from "@/lib/platform-gateway-entitlement";
import { prisma } from "@/lib/prisma";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export async function requireQuickReplicaUser(request: Request) {
  const auth = verifyToolsBearer(request);
  if (!auth.ok) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "未登录" }, { status: 401 }),
    };
  }

  try {
    await assertGatewayApiKeyLinkedForUser(auth.userId);
    await assertPlatformGatewayEntitlement(auth.userId, { navKey: "quick-replica" });
  } catch (e) {
    if (e instanceof PlatformEntitlementError) {
      return {
        ok: false as const,
        response: NextResponse.json(
          { error: e.message, code: e.code },
          { status: e.httpStatus },
        ),
      };
    }
    if (e instanceof GatewayRequiredError) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: e.message, code: e.code }, { status: 403 }),
      };
    }
    throw e;
  }

  return { ok: true as const, userId: auth.userId };
}

export async function requireQuickReplicaSession(request: Request) {
  const auth = verifyToolsBearer(request);
  if (!auth.ok) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "未登录" }, { status: 401 }),
    };
  }
  return { ok: true as const, userId: auth.userId };
}

export async function requireQuickReplicaFinanceAdmin(request: Request) {
  const auth = await requireQuickReplicaSession(request);
  if (!auth.ok) return auth;

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { role: true },
  });
  if (!canViewFinanceCost(user?.role)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "需要财务/超管权限" }, { status: 403 }),
    };
  }
  return { ok: true as const, userId: auth.userId };
}
