import { NextResponse, type NextRequest } from "next/server";
import { requireGatewaySessionUser } from "@/lib/gateway/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await requireGatewaySessionUser(request);
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      source: user.source,
      bookUserId: user.bookUserId,
    },
  });
}

export async function DELETE(request: NextRequest) {
  await requireGatewaySessionUser(request);
  const res = NextResponse.json({ ok: true });
  res.cookies.set("gateway_token", "", { path: "/", maxAge: 0 });
  return res;
}
