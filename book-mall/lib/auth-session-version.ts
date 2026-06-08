/**
 * 单会话「挤下线」（里程碑 7）
 *
 * 机制：每次成功登录把 User.sessionVersion +1，并写入新签发的 JWT（token.sv）。
 * 之后每个请求在 NextAuth jwt 回调里（受 SINGLE_SESSION_ENFORCE 控制、限频）核对
 * token.sv 与 DB sessionVersion；不一致即判定该会话已被新登录挤下线，强制失效。
 *
 * 默认关闭（无需 Redis）：设置 SINGLE_SESSION_ENFORCE=1 开启。
 */
import { prisma } from "@/lib/prisma";

export function isSingleSessionEnforced(): boolean {
  return process.env.SINGLE_SESSION_ENFORCE === "1";
}

/** 重新核对 DB 的间隔（秒），降低每请求查库成本。 */
const RECHECK_INTERVAL_SEC = Number(process.env.SINGLE_SESSION_RECHECK_SEC ?? "60");

/** 登录成功：自增并返回最新 sessionVersion（用于写入新 JWT）。 */
export async function bumpSessionVersion(userId: string): Promise<number> {
  const u = await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  return u.sessionVersion;
}

/** 读取当前 sessionVersion。 */
export async function getSessionVersion(userId: string): Promise<number> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { sessionVersion: true },
  });
  return u?.sessionVersion ?? 0;
}

/**
 * 判断 token 是否仍有效（限频核对）。返回 false 表示应失效。
 * 通过传入/回写 lastCheckedAt（epoch 秒）来限频。
 */
export async function isTokenSessionValid(input: {
  userId: string;
  tokenVersion: number | undefined;
  lastCheckedAt: number | undefined;
  now?: number;
}): Promise<{ valid: boolean; checkedAt: number }> {
  const now = input.now ?? Math.floor(Date.now() / 1000);
  // 旧 token 无 sv：视为有效（迁移期不挤旧会话），但标记已检查
  if (input.tokenVersion == null) return { valid: true, checkedAt: now };

  const stale =
    input.lastCheckedAt == null || now - input.lastCheckedAt >= RECHECK_INTERVAL_SEC;
  if (!stale) return { valid: true, checkedAt: input.lastCheckedAt ?? now };

  try {
    const current = await getSessionVersion(input.userId);
    return { valid: current === input.tokenVersion, checkedAt: now };
  } catch {
    // 查库失败不误伤会话
    return { valid: true, checkedAt: now };
  }
}
