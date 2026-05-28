import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export type PlatformUser = {
  id: string;
  name: string | null;
  email: string | null;
  role?: string;
  /** 来自 platform JWT 时为 true */
  fromPlatformToken?: boolean;
};

/**
 * 解析当前请求用户：优先 Bearer platform token（tools JWT），回落 NextAuth Cookie。
 * Canvas / Story / 工具站 BFF 与 book-mall API 迁移期双轨支持。
 */
export async function resolvePlatformUser(
  request: NextRequest,
): Promise<PlatformUser | null> {
  const bearer = verifyToolsBearer(request);
  if (bearer.ok) {
    return {
      id: bearer.userId,
      name: null,
      email: null,
      fromPlatformToken: true,
    };
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  return {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    role: session.user.role,
    fromPlatformToken: false,
  };
}
