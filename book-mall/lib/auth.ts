import { applyBookMallProductionOriginDefaults } from "./production-origin";

applyBookMallProductionOriginDefaults();

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  bumpSessionVersion,
  isSingleSessionEnforced,
  isTokenSessionValid,
} from "@/lib/auth-session-version";

/** 生产跨子域（book / f / tool）共享会话；本地不设 domain，保持 host-only Cookie。 */
function nextAuthSharedCookieDomain(): string | undefined {
  const d = process.env.NEXTAUTH_COOKIE_DOMAIN?.trim();
  return d || undefined;
}

/**
 * 跨子域共享会话时须同时覆盖 csrfToken。
 * 默认 `__Host-next-auth.csrf-token` 不能设 Domain，会导致登录/退出 CSRF 校验失败（前端表现为点了没反应）。
 */
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
      name: "邮箱密码",
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = (user as { role?: string }).role ?? "USER";
        token.name = user.name ?? undefined;
        token.picture = user.image ?? undefined;
        // 多租户：登录时缓存主空间（个人租户）id
        try {
          const u = await prisma.user.findUnique({
            where: { id: user.id },
            select: { primaryTenantId: true },
          });
          token.primaryTenantId = u?.primaryTenantId ?? null;
        } catch {
          token.primaryTenantId = null;
        }
        // 单会话：登录自增 sessionVersion 并写入新 JWT（挤掉旧会话）
        if (isSingleSessionEnforced()) {
          try {
            token.sv = await bumpSessionVersion(user.id);
            token.svAt = Math.floor(Date.now() / 1000);
          } catch {
            // 忽略：不阻断登录
          }
        }
        return token;
      }

      // 后续请求：单会话核对（限频）；不一致即失效该会话
      if (isSingleSessionEnforced() && token.sub) {
        const res = await isTokenSessionValid({
          userId: token.sub,
          tokenVersion: token.sv as number | undefined,
          lastCheckedAt: token.svAt as number | undefined,
        });
        if (!res.valid) {
          // 返回空 token → session 回调无 user.id → 视为已登出（被挤下线）
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
      }
      return session;
    },
  },
};
