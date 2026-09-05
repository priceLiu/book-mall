import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { canManagePricing } from "@/lib/auth/permissions";
import { normalizePhone, isValidCnPhone } from "@/lib/auth/phone";
import {
  verifySmsCode,
  SmsVerificationError,
} from "@/lib/auth/sms-verification-service";
import { isAdminOnlyTopupPack, packById } from "@/lib/billing/credit-topup-packs";
import { issueAdminTopupVerifyToken } from "@/lib/payments/admin-topup-verify-token";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  packId: z.string().min(1),
  phone: z.string().min(1),
  code: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canManagePricing(session.user.role)) {
    return NextResponse.json({ error: "无权操作" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 });
  }

  const pack = packById(parsed.data.packId);
  if (!pack || !isAdminOnlyTopupPack(pack) || !pack.requirePhoneVerify) {
    return NextResponse.json({ error: "无效的积分包档位" }, { status: 400 });
  }

  const phone = normalizePhone(parsed.data.phone);
  if (!phone || !isValidCnPhone(phone)) {
    return NextResponse.json({ error: "手机号格式无效" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true, phoneVerifiedAt: true },
  });
  if (!user?.phoneVerifiedAt || !user.phone) {
    return NextResponse.json({ error: "当前账号未绑定已验证手机号" }, { status: 400 });
  }
  if (user.phone !== phone) {
    return NextResponse.json({ error: "请输入与本账号注册时一致的手机号" }, { status: 400 });
  }

  try {
    await verifySmsCode({
      phoneRaw: phone,
      purpose: "LOGIN",
      code: parsed.data.code.trim(),
    });
  } catch (e) {
    if (e instanceof SmsVerificationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }

  const verifyToken = issueAdminTopupVerifyToken(session.user.id, pack.id);
  return NextResponse.json({ ok: true, verifyToken });
}
