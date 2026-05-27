import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  getGatewayJwtTtlSec,
  requireGatewayJwtSecret,
} from "@/lib/gateway/env";
import { signGatewayAccessToken } from "@/lib/gateway/gateway-sso-token";
import { findGatewayUserByEmail } from "@/lib/gateway/sync-user";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().max(64).optional(),
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

  const email = parsed.data.email.trim().toLowerCase();
  const bookExists = await prisma.user.findUnique({ where: { email } });
  if (bookExists) {
    return NextResponse.json(
      { error: "该邮箱已在 Book 注册，请使用 Book 账号登录 Gateway" },
      { status: 409 },
    );
  }

  const gwExists = await findGatewayUserByEmail(email);
  if (gwExists) {
    return NextResponse.json({ error: "该邮箱已注册" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.gatewayUser.create({
    data: {
      email,
      passwordHash,
      name: parsed.data.name?.trim() || null,
      source: "LOCAL",
    },
  });

  const secret = requireGatewayJwtSecret();
  const expiresIn = getGatewayJwtTtlSec();
  const token = signGatewayAccessToken({
    gatewayUserId: user.id,
    secret,
    expiresInSec: expiresIn,
    profile: { email: user.email, name: user.name },
  });

  const res = NextResponse.json({ ok: true, userId: user.id, access_token: token, expires_in: expiresIn });
  res.cookies.set("gateway_token", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: expiresIn,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
