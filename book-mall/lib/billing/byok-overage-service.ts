import type { ByokTaskKind, GatewayRequestLog } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  BYOK_SCOPE_PERSONAL,
  BYOK_SCOPE_TEAM_SEAT,
  BYOK_TEAM_MIN_SEATS,
} from "@/lib/billing/byok-pricing";
import type { AccountRef } from "@/lib/billing/credit-account-service";

/** BYOK 额度表已退役；保留 scope 解析供历史对账脚本编译。 */
export async function resolveByokScope(ref: AccountRef): Promise<{
  scopeKey: string;
  seats: number;
}> {
  if (ref.ownerType === "USER") {
    return { scopeKey: BYOK_SCOPE_PERSONAL, seats: 1 };
  }
  const members = await prisma.tenantMember.count({
    where: { tenantId: ref.ownerId, status: "ACTIVE" },
  });
  const seats = Math.max(BYOK_TEAM_MIN_SEATS, members);
  return { scopeKey: BYOK_SCOPE_TEAM_SEAT, seats };
}

export async function assertByokQuotaBeforeGenerate(_input: {
  tenantId?: string | null;
  actorBookUserId?: string | null;
  apiKeyId: string;
  requestKind?: string | null;
  inputSummary?: unknown;
}): Promise<void> {
  return;
}

export type ByokOverageResult = {
  taskKind: ByokTaskKind;
  scopeKey: string;
  isOverage: boolean;
  creditsCharged: number;
  includedUsed: number;
  overageUsed: number;
  monthlyIncluded: number;
  includedRemainingAfter: number;
};

export async function settleByokOverage(
  _log: GatewayRequestLog,
): Promise<ByokOverageResult | null> {
  return null;
}
