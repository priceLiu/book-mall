import type { GatewayUser } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type GatewayBookRole = "ADMIN" | "USER";

/** Gateway 会话角色：与 Book User.role 同步（有 bookUserId 时） */
export async function resolveGatewayBookRole(
  gwUser: Pick<GatewayUser, "bookUserId">,
): Promise<GatewayBookRole> {
  if (!gwUser.bookUserId) return "USER";
  const bookUser = await prisma.user.findUnique({
    where: { id: gwUser.bookUserId },
    select: { role: true },
  });
  return bookUser?.role === "ADMIN" ? "ADMIN" : "USER";
}
