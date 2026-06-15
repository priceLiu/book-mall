import type { SmsVerificationPurpose } from "@prisma/client";

export type SmsProvider = "mock" | "tencent";

export function smsProvider(): SmsProvider {
  const v = process.env.SMS_PROVIDER?.trim().toLowerCase();
  if (v === "tencent") return "tencent";
  return "mock";
}

export function templateIdForPurpose(purpose: SmsVerificationPurpose): string | null {
  const map: Partial<Record<SmsVerificationPurpose, string | undefined>> = {
    REGISTER: process.env.TENCENT_SMS_TEMPLATE_REGISTER,
    LOGIN: process.env.TENCENT_SMS_TEMPLATE_LOGIN,
    BIND_PHONE: process.env.TENCENT_SMS_TEMPLATE_BIND,
    TEAM_INVITE: process.env.TENCENT_SMS_TEMPLATE_TEAM_INVITE,
    RESET_PASSWORD: process.env.TENCENT_SMS_TEMPLATE_LOGIN,
  };
  const id = map[purpose]?.trim();
  return id || null;
}

export function tencentSmsConfig() {
  return {
    secretId: process.env.TENCENT_SMS_SECRET_ID?.trim() ?? "",
    secretKey: process.env.TENCENT_SMS_SECRET_KEY?.trim() ?? "",
    region: process.env.TENCENT_SMS_REGION?.trim() || "ap-guangzhou",
    sdkAppId: process.env.TENCENT_SMS_SDK_APP_ID?.trim() ?? "",
    signName: process.env.TENCENT_SMS_SIGN_NAME?.trim() ?? "",
  };
}

export function isTencentSmsConfigured(): boolean {
  const c = tencentSmsConfig();
  return Boolean(c.secretId && c.secretKey && c.sdkAppId && c.signName);
}
