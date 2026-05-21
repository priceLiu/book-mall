import { applyBookMallProductionOriginDefaults } from "./production-origin";

applyBookMallProductionOriginDefaults();

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/** 生产跨子域（book / f / tool）共享会话；本地不设 domain，保持 host-only Cookie。 */
function nextAuthSharedCookieDomain(): string | undefined {
  const d = process.env.NEXTAUTH_COOKIE_DOMAIN?.trim();
  return d || undefined;
}

function nextAuthCookieOptions() {
  const domain = nextAuthSharedCookieDomain();
  if (!domain) return undefined;
  return { domain, path: "/", sameSite: "lax" as const };
}

const sharedCookieOpts = nextAuthCookieOptions();

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  ...(sharedCookieOpts
    ? {
        cookies: {
          sessionToken: { options: sharedCookieOpts },
          callbackUrl: { options: sharedCookieOpts },
          csrfToken: { options: sharedCookieOpts },
        },
      }
    : {}),
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
      }
      return session;
    },
  },
};
