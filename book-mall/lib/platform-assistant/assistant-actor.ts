/**
 * 平台 AI 小智 · 登录用户 / 匿名访客统一身份（限流、反馈）。
 */
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export type AssistantActor = {
  /** 已登录 Book 用户 id；匿名为 null */
  userId: string | null;
  /** 限流桶 key */
  rateLimitKey: string;
  isGuest: boolean;
};

function readClientIp(request: Request): string {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

/** 已登录优先；否则匿名访客（平台代付，按 IP 限流）。 */
export async function resolveAssistantActor(
  request: Request,
): Promise<AssistantActor> {
  const auth = verifyToolsBearer(request);
  if (auth.ok) {
    return {
      userId: auth.userId,
      rateLimitKey: `user:${auth.userId}`,
      isGuest: false,
    };
  }

  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    return {
      userId: session.user.id,
      rateLimitKey: `user:${session.user.id}`,
      isGuest: false,
    };
  }

  const ip = readClientIp(request);
  return {
    userId: null,
    rateLimitKey: `guest:${ip}`,
    isGuest: true,
  };
}
