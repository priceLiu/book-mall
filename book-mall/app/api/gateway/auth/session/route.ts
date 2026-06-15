import { NextResponse, type NextRequest } from "next/server";
import { resolveGatewayBookRole } from "@/lib/gateway/book-role";
import { resolveGatewayCredentialScope } from "@/lib/gateway/platform-credential-delegate";
import { requireGatewaySessionUser } from "@/lib/gateway/session";
import { phoneFromGatewayEmail } from "@/lib/auth/user-display";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await requireGatewaySessionUser(request);
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  const bookRole = await resolveGatewayBookRole(user);
  const credentialScope = await resolveGatewayCredentialScope(user);
  let billingPersona: string | null = null;
  let phone: string | null = phoneFromGatewayEmail(user.email);
  if (user.bookUserId) {
    const bookUser = await prisma.user.findUnique({
      where: { id: user.bookUserId },
      select: { billingPersona: true, billingPersonaLockedAt: true, phone: true },
    });
    if (bookUser?.billingPersonaLockedAt) {
      billingPersona = bookUser.billingPersona;
    }
    phone = bookUser?.phone ?? phone;
  }
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      phone,
      name: user.name,
      source: user.source,
      bookUserId: user.bookUserId,
      bookRole,
      billingPersona,
      platformPoolDelegate: credentialScope.isPlatformPoolDelegate
        ? { canonicalOwnerEmail: credentialScope.canonicalOwnerEmail }
        : null,
    },
  });
}

export async function DELETE(request: NextRequest) {
  await requireGatewaySessionUser(request);
  const res = NextResponse.json({ ok: true });
  res.cookies.set("gateway_token", "", { path: "/", maxAge: 0 });
  return res;
}
