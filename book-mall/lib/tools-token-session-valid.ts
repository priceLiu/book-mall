import type { ClientDeviceType } from "@prisma/client";
import {
  getDeviceSessionVersion,
  getSessionVersion,
  isSingleSessionEnforced,
} from "@/lib/auth-session-version";

/**
 * 校验 tools JWT 的 sv 是否仍有效。
 * - 含 device_type：对照 UserDeviceSessionVersion（按类型挤下线）
 * - 不含 device_type：对照 User.sessionVersion（网页 NextAuth 全局）
 */
export async function isToolsTokenSessionValid(input: {
  userId: string;
  tokenVersion: number | undefined;
  deviceType?: ClientDeviceType | null;
}): Promise<boolean> {
  if (!isSingleSessionEnforced()) return true;
  if (input.tokenVersion == null) return true;

  if (input.deviceType) {
    const current = await getDeviceSessionVersion(input.userId, input.deviceType);
    return current === input.tokenVersion;
  }

  const current = await getSessionVersion(input.userId);
  return current === input.tokenVersion;
}
