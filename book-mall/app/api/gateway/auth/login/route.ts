import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  getGatewayJwtTtlSec,
  requireGatewayJwtSecret,
} from "@/lib/gateway/env";
import { signGatewayAccessToken } from "@/lib/gateway/gateway-sso-token";
import { findGatewayUserByEmail } from "@/lib/gateway/sync-user";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "无效请求" }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 });
  }

  const user = await findGatewayUserByEmail(parsed.data.email);
  if (!user?.passwordHash) {
    return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
  }

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
  }

  const secret = requireGatewayJwtSecret();
  const expiresIn = getGatewayJwtTtlSec();
  const token = signGatewayAccessToken({
    gatewayUserId: user.id,
    secret,
    expiresInSec: expiresIn,
    profile: { email: user.email, name: user.name },
  });

  const res = NextResponse.json({
    ok: true,
    access_token: token,
    expires_in: expiresIn,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      source: user.source,
      bookUserId: user.bookUserId,
    },
  });
  res.cookies.set("gateway_token", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: expiresIn,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
