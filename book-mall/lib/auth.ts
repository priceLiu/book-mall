import { applyBookMallProductionOriginDefaults } from "./production-origin";

applyBookMallProductionOriginDefaults();

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/auth/phone";
import {
  SmsVerificationError,
  verifySmsCode,
} from "@/lib/auth/sms-verification-service";
import { verifyAutoLoginToken } from "@/lib/auth/auto-login-token";
import { allowDevMockAuth, DEV_AUTH_PASSWORD, isDevAuthPhone } from "@/lib/dev-mock-auth";
import {
  bumpSessionVersion,
  isSingleSessionEnforced,
  isTokenSessionValid,
} from "@/lib/auth-session-version";
import { SESSION_KICK_COOKIE } from "@/lib/session-kick-cookie";

/** 生产跨子域（book / f / tool）共享会话；本地不设 domain，保持 host-only Cookie。 */
function nextAuthSharedCookieDomain(): string | undefined {
  const d = process.env.NEXTAUTH_COOKIE_DOMAIN?.trim();
  return d || undefined;
}

function buildNextAuthSharedCookies(): NextAuthOptions["cookies"] | undefined {
  const domain = nextAuthSharedCookieDomain();
  if (!domain) return undefined;

  const secure =
    process.env.NODE_ENV === "production" ||
    (process.env.NEXTAUTH_URL ?? "").startsWith("https://");
  const prefix = secure ? "__Secure-" : "";

  const sharedHttpOnly = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure,
    domain,
  };

  return {
    sessionToken: {
      name: `${prefix}next-auth.session-token`,
      options: sharedHttpOnly,
    },
    callbackUrl: {
      name: `${prefix}next-auth.callback-url`,
      options: {
        httpOnly: false,
        sameSite: "lax",
        path: "/",
        secure,
        domain,
      },
    },
    csrfToken: {
      name: `${prefix}next-auth.csrf-token`,
      options: sharedHttpOnly,
    },
  };
}

const sharedCookies = buildNextAuthSharedCookies();

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  ...(sharedCookies ? { cookies: sharedCookies } : {}),
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "手机号",
      credentials: {
        phone: { label: "手机号", type: "text" },
        password: { label: "密码", type: "password" },
        code: { label: "验证码", type: "text" },
        loginMode: { label: "模式", type: "text" },
        inviteToken: { label: "邀请 token", type: "text" },
        autoLoginToken: { label: "自动登录票据", type: "text" },
      },
      async authorize(credentials) {
        const phone = normalizePhone(credentials?.phone);
        if (!phone) return null;

        const loginMode = credentials?.loginMode?.trim() || "password";
        const inviteToken = credentials?.inviteToken?.trim() || undefined;

        const user = await prisma.user.findUnique({
          where: { phone },
        });
        if (!user) return null;

        if (loginMode === "autologin") {
          // 注册成功后免密自动登录：校验服务端签发的一次性票据，且票据 userId 与手机号匹配。
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
          if (allowDevMockAuth() && isDevAuthPhone(phone) && password === DEV_AUTH_PASSWORD) {
            // dev test account
          }
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
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (trigger === "update" && session && typeof session === "object") {
        const patch = session as { name?: string | null };
        if ("name" in patch) {
          token.name = patch.name ?? undefined;
        }
        return token;
      }

      if (user) {
        token.sub = user.id;
        token.role = (user as { role?: string }).role ?? "USER";
        token.name = user.name ?? undefined;
        token.picture = user.image ?? undefined;
        try {
          const u = await prisma.user.findUnique({
            where: { id: user.id },
            select: { primaryTenantId: true, phone: true, phoneVerifiedAt: true },
          });
          token.primaryTenantId = u?.primaryTenantId ?? null;
          token.phone = u?.phone ?? null;
          token.phoneVerified = Boolean(u?.phoneVerifiedAt);
        } catch {
          token.primaryTenantId = null;
        }
        if (isSingleSessionEnforced()) {
          try {
            token.sv = await bumpSessionVersion(user.id);
            token.svAt = Math.floor(Date.now() / 1000);
            cookies().set(SESSION_KICK_COOKIE, "", { path: "/", maxAge: 0 });
          } catch {
            /* non-fatal */
          }
        }
        return token;
      }

      if (isSingleSessionEnforced() && token.sub) {
        const res = await isTokenSessionValid({
          userId: token.sub,
          tokenVersion: token.sv as number | undefined,
          lastCheckedAt: token.svAt as number | undefined,
        });
        if (!res.valid) {
          try {
            cookies().set(SESSION_KICK_COOKIE, "1", {
              path: "/",
              maxAge: 120,
              sameSite: "lax",
            });
          } catch {
            /* non-fatal */
          }
          return {};
        }
        token.svAt = res.checkedAt;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = (token.role as string) ?? "USER";
        session.user.name = (token.name as string | null | undefined) ?? session.user.name;
        session.user.image =
          (token.picture as string | null | undefined) ?? session.user.image;
        session.user.primaryTenantId =
          (token.primaryTenantId as string | null | undefined) ?? null;
        session.user.phone = (token.phone as string | null | undefined) ?? null;
        session.user.phoneVerified = Boolean(token.phoneVerified);
      }
      return session;
    },
  },
};
