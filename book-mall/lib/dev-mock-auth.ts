/** 是否允许开发用模拟认证 API 与 /dev/auth 页面。 */
export function allowDevMockAuth(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  return process.env.ALLOW_DEV_AUTH === "true";
}

export type DevAuthPersona =
  | "personal"
  | "team_owner"
  | "team_member"
  | "admin";

/** 开发测试账号手机号（seed 或首次访问时创建） */
export const DEV_AUTH_PHONES: Record<DevAuthPersona, string> = {
  personal: "13800000001",
  team_owner: "13800000002",
  team_member: "13800000003",
  admin: "13800000009",
};

export const DEV_AUTH_PASSWORD = "DevAuth888!";

export function isDevAuthPhone(phone: string): boolean {
  return Object.values(DEV_AUTH_PHONES).includes(phone);
}
