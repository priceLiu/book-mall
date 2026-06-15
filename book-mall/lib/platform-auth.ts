import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { formatUserDisplayLabel } from "@/lib/auth/user-display";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";
import { verifyToolsAccessToken } from "@/lib/tools-sso-token";
import { requireToolsJwtSecret } from "@/lib/sso-tools-env";

export type PlatformUser = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role?: string;
  /** 来自 platform JWT 时为 true */
  fromPlatformToken?: boolean;
};

function userFromToolsJwt(userId: string, jwt: {
  email?: string;
  name?: string;
  phone?: string;
}): PlatformUser {
  return {
    id: userId,
    name: jwt.name ?? null,
    email: jwt.email ?? null,
    phone: jwt.phone ?? null,
    fromPlatformToken: true,
  };
}

/**
 * 解析当前请求用户：优先 Bearer platform token（tools JWT），回落 NextAuth Cookie。
 * Canvas / Story / 工具站 BFF 与 book-mall API 迁移期双轨支持。
 */
export async function resolvePlatformUser(
  request: NextRequest,
): Promise<PlatformUser | null> {
  const auth = request.headers.get("authorization");
  const raw =
    auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (raw) {
    try {
      const secret = requireToolsJwtSecret();
      const verified = verifyToolsAccessToken(raw, secret);
      if (verified) {
        return userFromToolsJwt(verified.sub, verified);
      }
    } catch {
      /* JWT secret 未配置等 */
    }
  }

  const bearer = verifyToolsBearer(request);
  if (bearer.ok) {
    return {
      id: bearer.userId,
      name: null,
      email: null,
      phone: null,
      fromPlatformToken: true,
    };
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  return {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    phone: session.user.phone ?? null,
    role: session.user.role,
    fromPlatformToken: false,
  };
}

export { formatUserDisplayLabel };
