import type { SmsVerificationPurpose } from "@prisma/client";

import { toE164Cn } from "@/lib/auth/phone";
import { buildTeamInviteUrl } from "@/lib/tenant/team-invite-link";
import { getInviteByToken } from "@/lib/tenant/tenant-invite-service";
import {
  isTencentSmsConfigured,
  smsProvider,
  templateIdForPurpose,
  tencentSmsConfig,
} from "@/lib/sms/sms-config";

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
}): Promise<void> {
  const cfg = tencentSmsConfig();
  const tencentcloud = await import("tencentcloud-sdk-nodejs");
  const SmsClient = tencentcloud.sms.v20210111.Client;
  const client = new SmsClient({
    credential: { secretId: cfg.secretId, secretKey: cfg.secretKey },
    region: cfg.region,
    profile: { httpProfile: { endpoint: "sms.tencentcloudapi.com" } },
  });

  await client.SendSms({
    PhoneNumberSet: [toE164Cn(input.phone)],
    SmsSdkAppId: cfg.sdkAppId,
    SignName: cfg.signName,
    TemplateId: input.templateId,
    TemplateParamSet: input.params,
  });
}

export async function sendSmsMessage(input: {
  phone: string;
  purpose: SmsVerificationPurpose;
  code: string;
  inviteToken?: string;
}): Promise<void> {
  if (smsProvider() === "mock" || !isTencentSmsConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      const linkHint =
        input.purpose === "TEAM_INVITE" && input.inviteToken
          ? ` link=${buildTeamInviteUrl(input.inviteToken, input.code)}`
          : "";
      console.info(
        `[sms:mock] ${purposeLabel(input.purpose)} → ${input.phone} code=${input.code}${linkHint}`,
      );
    }
    return;
  }

  const templateId = templateIdForPurpose(input.purpose);
  if (!templateId) {
    console.warn(`[sms] 未配置模板 ${input.purpose}，跳过真实发送`);
    return;
  }

  const params: string[] = [input.code];
  if (input.purpose === "TEAM_INVITE" && input.inviteToken) {
    const invite = await getInviteByToken(input.inviteToken);
    const teamName = invite && "tenant" in invite ? invite.tenant.name : "团队";
    params.push(teamName, buildTeamInviteUrl(input.inviteToken, input.code));
  }

  await sendViaTencent({ phone: input.phone, templateId, params });
}
