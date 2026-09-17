import type { Prisma, SmsSendStatus, SmsVerificationPurpose } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const PORTAL_APP_HEADER = "x-portal-app";

export type SmsLogChannel = "direct" | "portal-bff";

export type RecordSmsSendLogInput = {
  phone: string;
  purpose: SmsVerificationPurpose;
  code?: string | null;
  source: string;
  channel: SmsLogChannel;
  status: SmsSendStatus;
  provider?: string | null;
  templateId?: string | null;
  sendIp?: string | null;
  userAgent?: string | null;
  inviteToken?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  detail?: Record<string, unknown> | null;
  verificationId?: string | null;
};

/** 门户 BFF 请求头 → 日志来源标识 */
export function portalSmsSourceFromRequest(request: Request): string {
  const app = request.headers.get(PORTAL_APP_HEADER)?.trim();
  return app ? `portal:${app}` : "portal:unknown";
}

export function parseSmsSendError(e: unknown): { errorCode?: string; errorMessage: string } {
  if (!(e instanceof Error)) {
    return { errorMessage: String(e) };
  }
  if (e.message === "SMS_PACKAGE_EMPTY") {
    return {
      errorCode: "SMS_PACKAGE_EMPTY",
      errorMessage: "腾讯云短信套餐余额不足",
    };
  }
  const m = e.message.match(/^短信发送失败: ([^:]+): (.+)$/);
  if (m) {
    return { errorCode: m[1], errorMessage: m[2] };
  }
  return { errorMessage: e.message };
}

/** 写入短信发送审计；失败不阻断主流程 */
export async function recordSmsSendLog(input: RecordSmsSendLogInput): Promise<void> {
  try {
    const detailJson =
      input.detail && Object.keys(input.detail).length > 0
        ? (input.detail as Prisma.InputJsonValue)
        : undefined;
    await prisma.smsSendLog.create({
      data: {
        phone: input.phone,
        purpose: input.purpose,
        code: input.code ?? null,
        source: input.source.slice(0, 64),
        channel: input.channel.slice(0, 32),
        status: input.status,
        provider: input.provider?.slice(0, 32) ?? null,
        templateId: input.templateId?.slice(0, 64) ?? null,
        sendIp: input.sendIp?.slice(0, 45) ?? null,
        userAgent: input.userAgent?.slice(0, 512) ?? null,
        inviteToken: input.inviteToken?.slice(0, 128) ?? null,
        errorCode: input.errorCode?.slice(0, 128) ?? null,
        errorMessage: input.errorMessage?.slice(0, 500) ?? null,
        detailJson,
        verificationId: input.verificationId ?? null,
      },
    });
  } catch (e) {
    console.error("[sms-send-log] persist failed", e);
  }
}
