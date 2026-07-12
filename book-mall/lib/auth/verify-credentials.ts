import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/auth/phone";
import {
  SmsVerificationError,
  verifySmsCode,
} from "@/lib/auth/sms-verification-service";
import { verifyAutoLoginToken } from "@/lib/auth/auto-login-token";

/**
 * 统一凭证校验（唯一真源）。
 * NextAuth CredentialsProvider.authorize 与门户无头登录端点 `/api/sso/portal/verify`
 * 都调用它，避免多套重复的登录逻辑。
 */
export type CredentialsLoginInput = {
  phone?: string | null;
  password?: string | null;
  code?: string | null;
  /** password | otp | autologin */
  loginMode?: string | null;
  inviteToken?: string | null;
  autoLoginToken?: string | null;
};

export type VerifiedLoginUser = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  role: UserRole;
};

/**
 * 校验手机号 + (密码 | 短信验证码 | 一次性自动登录票据)。
 * 成功返回精简用户对象；任何失败返回 null（不抛业务错误，与 authorize 语义一致）。
 */
export async function verifyCredentialsLogin(
  credentials: CredentialsLoginInput | undefined,
): Promise<VerifiedLoginUser | null> {
  const phone = normalizePhone(credentials?.phone);
  if (!phone) return null;

  const loginMode = credentials?.loginMode?.trim() || "password";
  const inviteToken = credentials?.inviteToken?.trim() || undefined;

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) return null;

  if (loginMode === "autologin") {
    // 注册/门户登录后免密自动登录：校验服务端签发的一次性票据，且票据 userId 与手机号匹配。
    const tokenUserId = verifyAutoLoginToken(credentials?.autoLoginToken);
    if (!tokenUserId || tokenUserId !== user.id) return null;
  } else if (loginMode === "otp") {
    const code = credentials?.code?.trim();
    if (!code) return null;
    try {
      await verifySmsCode({
        phoneRaw: phone,
        purpose: inviteToken ? "TEAM_INVITE" : "LOGIN",
        code,
        inviteToken,
      });
    } catch (e) {
      if (e instanceof SmsVerificationError) return null;
      throw e;
    }
  } else if (loginMode === "password") {
    const password = credentials?.password;
    if (!password || !user.passwordHash) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;
  } else {
    return null;
  }

  if (!user.phoneVerifiedAt) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    role: user.role,
  };
}
