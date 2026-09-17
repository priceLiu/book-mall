import type { SmsVerificationPurpose } from "@prisma/client";

import { isMockSmsPhone, isTestPrefixPhone, toE164Cn } from "@/lib/auth/phone";
import { buildTeamInviteUrl } from "@/lib/tenant/team-invite-link";
import { getInviteByToken } from "@/lib/tenant/tenant-invite-service";
import {
  isTencentSmsConfigured,
  smsProvider,
  templateIdForPurpose,
  tencentSmsConfig,
} from "@/lib/sms/sms-config";

export type SmsSendResult = {
  provider: "mock" | "tencent" | "skipped";
  templateId?: string;
  tencentCode?: string;
  tencentMessage?: string;
};

function purposeLabel(purpose: SmsVerificationPurpose): string {
  switch (purpose) {
    case "REGISTER":
      return "注册";
    case "LOGIN":
      return "登录";
    case "BIND_PHONE":
      return "绑定手机";
    case "TEAM_INVITE":
      return "团队邀请";
    case "RESET_PASSWORD":
      return "重置密码";
    default:
      return "验证";
  }
}

async function sendViaTencent(input: {
  phone: string;
  templateId: string;
  params: string[];
}): Promise<{ tencentCode: string; tencentMessage: string }> {
  const cfg = tencentSmsConfig();
  const tencentcloud = await import("tencentcloud-sdk-nodejs");
  const SmsClient = tencentcloud.sms.v20210111.Client;
  const client = new SmsClient({
    credential: { secretId: cfg.secretId, secretKey: cfg.secretKey },
    region: cfg.region,
    profile: { httpProfile: { endpoint: "sms.tencentcloudapi.com" } },
  });

  const resp = await client.SendSms({
    PhoneNumberSet: [toE164Cn(input.phone)],
    SmsSdkAppId: cfg.sdkAppId,
    SignName: cfg.signName,
    TemplateId: input.templateId,
    TemplateParamSet: input.params,
  });

  const status = resp.SendStatusSet?.[0];
  if (!status || status.Code !== "Ok") {
    const code = status?.Code ?? "NO_RESPONSE";
    const message = status?.Message ?? "无响应";
    console.error("[sms:tencent] 发送失败", {
      phone: input.phone,
      templateId: input.templateId,
      signName: cfg.signName,
      sdkAppId: cfg.sdkAppId,
      code,
      message,
    });
    if (code === "FailedOperation.InsufficientBalanceInSmsPackage") {
      throw new Error("SMS_PACKAGE_EMPTY");
    }
    throw new Error(`短信发送失败: ${code}: ${message}`);
  }

  console.info(`[sms:tencent] 发送成功 → ${input.phone} template=${input.templateId}`);
  return {
    tencentCode: status.Code ?? "Ok",
    tencentMessage: status.Message ?? "",
  };
}

function shouldMockSend(phone: string): boolean {
  return (
    smsProvider() === "mock" ||
    !isTencentSmsConfigured() ||
    isMockSmsPhone(phone) ||
    isTestPrefixPhone(phone)
  );
}

export async function sendSmsMessage(input: {
  phone: string;
  purpose: SmsVerificationPurpose;
  code: string;
  inviteToken?: string;
}): Promise<SmsSendResult> {
  if (shouldMockSend(input.phone)) {
    if (process.env.NODE_ENV !== "production") {
      const linkHint =
        input.purpose === "TEAM_INVITE" && input.inviteToken
          ? ` link=${buildTeamInviteUrl(input.inviteToken, input.code)}`
          : "";
      console.info(
        `[sms:mock] ${purposeLabel(input.purpose)} → ${input.phone} code=${input.code}${linkHint}`,
      );
    }
    return { provider: "mock" };
  }

  const templateId = templateIdForPurpose(input.purpose);
  if (!templateId) {
    console.warn(`[sms] 未配置模板 ${input.purpose}，跳过真实发送`);
    return { provider: "skipped" };
  }

  const params: string[] = [input.code];
  if (input.purpose === "TEAM_INVITE" && input.inviteToken) {
    const invite = await getInviteByToken(input.inviteToken);
    const teamName = invite && "tenant" in invite ? invite.tenant.name : "团队";
    params.push(teamName, buildTeamInviteUrl(input.inviteToken, input.code));
  }

  const tencent = await sendViaTencent({ phone: input.phone, templateId, params });
  return {
    provider: "tencent",
    templateId,
    tencentCode: tencent.tencentCode,
    tencentMessage: tencent.tencentMessage,
  };
}
