import type { GatewayUser } from "@prisma/client";

import {
  getCanonicalPlatformPoolOwnerEmail,
  getPlatformGatewayAdminEmails,
} from "@/lib/gateway/platform-credential-copy";
import { prisma } from "@/lib/prisma";

export type GatewayCredentialScope = {
  /** GatewayUser.id used for credential CRUD */
  effectiveGatewayUserId: string;
  /** Session user is editing canonical pool on behalf of owner */
  isPlatformPoolDelegate: boolean;
  canonicalOwnerEmail: string;
};

export async function resolveGatewayCredentialScope(
  sessionUser: GatewayUser,
): Promise<GatewayCredentialScope> {
  const canonicalOwnerEmail = getCanonicalPlatformPoolOwnerEmail();
  const sessionEmail = sessionUser.email.trim().toLowerCase();

  if (sessionEmail === canonicalOwnerEmail) {
    return {
      effectiveGatewayUserId: sessionUser.id,
      isPlatformPoolDelegate: false,
      canonicalOwnerEmail,
    };
  }

  const adminEmails = getPlatformGatewayAdminEmails();
  if (!adminEmails.includes(sessionEmail) || !sessionUser.bookUserId) {
    return {
      effectiveGatewayUserId: sessionUser.id,
      isPlatformPoolDelegate: false,
      canonicalOwnerEmail,
    };
  }

  const bookUser = await prisma.user.findUnique({
    where: { id: sessionUser.bookUserId },
    select: { role: true },
  });
  if (bookUser?.role !== "ADMIN" && bookUser?.role !== "FINANCE") {
    return {
      effectiveGatewayUserId: sessionUser.id,
      isPlatformPoolDelegate: false,
      canonicalOwnerEmail,
    };
  }

  const canonicalGw = await prisma.gatewayUser.findUnique({
    where: { email: canonicalOwnerEmail },
    select: { id: true },
  });
  if (!canonicalGw) {
    return {
      effectiveGatewayUserId: sessionUser.id,
      isPlatformPoolDelegate: false,
      canonicalOwnerEmail,
    };
  }

  return {
    effectiveGatewayUserId: canonicalGw.id,
    isPlatformPoolDelegate: true,
    canonicalOwnerEmail,
  };
}

export async function isCanonicalPlatformPoolOwner(gatewayUserId: string): Promise<boolean> {
  const ownerEmail = getCanonicalPlatformPoolOwnerEmail();
  const gw = await prisma.gatewayUser.findUnique({
    where: { id: gatewayUserId },
    select: { email: true },
  });
  return gw?.email.trim().toLowerCase() === ownerEmail;
}
