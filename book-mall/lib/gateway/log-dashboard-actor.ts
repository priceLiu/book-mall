/**
 * 状态驾驶舱 · 按手机号解析 actor + 日志行用户展示。
 */
import { formatUserDisplayLabel } from "@/lib/auth/user-display";
import { normalizePhone } from "@/lib/auth/phone";
import { prisma } from "@/lib/prisma";

export type GatewayLogActorDisplay = {
  id: string;
  phone: string | null;
  name: string | null;
  displayLabel: string;
};

const MIN_PARTIAL_PHONE_DIGITS = 4;

export function parseActorPhoneQuery(raw: string | null | undefined): string {
  return (raw ?? "").trim();
}

/** 按完整或前缀手机号解析 Book User.id 列表（至少 4 位数字）。 */
export async function resolveBookUserIdsByPhoneQuery(
  phoneRaw: string,
  opts?: { restrictToUserIds?: string[] },
): Promise<string[]> {
  const trimmed = phoneRaw.trim();
  if (!trimmed) return [];

  const normalized = normalizePhone(trimmed);
  const digits = trimmed.replace(/\D/g, "");
  if (!normalized && digits.length < MIN_PARTIAL_PHONE_DIGITS) return [];

  const users = await prisma.user.findMany({
    where: normalized
      ? { phone: normalized }
      : { phone: { startsWith: digits.slice(0, 11) } },
    select: { id: true },
    take: 20,
  });

  let ids = users.map((u) => u.id);
  if (opts?.restrictToUserIds?.length) {
    const allowed = new Set(opts.restrictToUserIds);
    ids = ids.filter((id) => allowed.has(id));
  }
  return ids;
}

export async function resolveTeamMemberUserIds(tenantId: string): Promise<string[]> {
  const members = await prisma.tenantMember.findMany({
    where: { tenantId, status: "ACTIVE" },
    select: { userId: true },
  });
  return [...new Set(members.map((m) => m.userId))];
}

export async function fetchGatewayLogActorDisplays(
  actorIds: string[],
): Promise<Map<string, GatewayLogActorDisplay>> {
  const unique = [...new Set(actorIds.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, phone: true, name: true, email: true },
  });

  return new Map(
    users.map((u) => [
      u.id,
      {
        id: u.id,
        phone: u.phone,
        name: u.name,
        displayLabel: formatUserDisplayLabel({
          id: u.id,
          name: u.name,
          phone: u.phone,
          email: u.email,
        }),
      },
    ]),
  );
}

export function emptyActorWhere(userId = "__none__"): { actorBookUserId: string } {
  return { actorBookUserId: userId };
}
