import type { NextRequest } from "next/server";
import { requireGatewayJwtSecret } from "@/lib/gateway/env";
import { verifyGatewayAccessToken } from "@/lib/gateway/gateway-sso-token";
import { prisma } from "@/lib/prisma";

export async function requireGatewaySessionUser(request: NextRequest) {
  const token =
    request.cookies.get("gateway_token")?.value ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  let secret: string;
  try {
    secret = requireGatewayJwtSecret();
  } catch {
    return null;
  }
  const verified = verifyGatewayAccessToken(token, secret);
  if (!verified) return null;
  const user = await prisma.gatewayUser.findUnique({
    where: { id: verified.sub },
  });
  if (!user) return null;
  return user;
}
