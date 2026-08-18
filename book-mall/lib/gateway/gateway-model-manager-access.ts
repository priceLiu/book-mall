import {
  getCanonicalPlatformPoolOwnerEmail,
  getPlatformGatewayAdminEmails,
} from "@/lib/gateway/platform-credential-copy";

/** Gateway 控制台是否展示「模型管理 / API 密钥 / 调试」等运维项 */
export function canAccessGatewayModelManager(input: {
  email: string;
  billingPersona?: string | null;
  bookRole?: string | null;
  isPlatformPoolDelegate?: boolean;
}): boolean {
  if (input.billingPersona === "BYOK") return true;
  if (input.isPlatformPoolDelegate) return true;

  const email = input.email.trim().toLowerCase();
  if (email === getCanonicalPlatformPoolOwnerEmail()) return true;

  const adminEmails = getPlatformGatewayAdminEmails();
  if (
    adminEmails.includes(email) &&
    (input.bookRole === "ADMIN" || input.bookRole === "FINANCE")
  ) {
    return true;
  }

  return false;
}
