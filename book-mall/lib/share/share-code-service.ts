import type { ShareRewardChannel, WorkflowShareApp } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { resolveReferrerByCode } from "@/lib/referral/referral-service";

import {
  buildShareCodePageUrl,
  generateShareCodeSuffix,
  isValidShareCodeCharset,
  normalizeShareCode,
  REFERRAL_CODE_LENGTH,
  REFERRAL_SUFFIX_LENGTH,
  SHARE_CODE_INVALID_MESSAGE,
  WORKFLOW_SUFFIX_LENGTH,
} from "./share-code-alphabet";
import {
  findEnabledPrefixForCode,
  getEnabledReferralPrefix,
  getEnabledWorkflowPrefix,
} from "./share-code-prefix-service";
import { getWorkflowSharePublicMeta } from "./workflow-share-service";

export type ShareCodeResolveKind = "REFERRAL" | "WORKFLOW";

export type ShareCodeResolveResult =
  | {
      ok: true;
      kind: ShareCodeResolveKind;
      code: string;
      title: string | null;
      sharerName: string | null;
      app?: WorkflowShareApp;
      legacyReferralPath?: string;
    }
  | { ok: false; message: string };

export { buildShareCodePageUrl, normalizeShareCode, SHARE_CODE_INVALID_MESSAGE };

export function matchShareCodePrefix(
  code: string,
  prefix: string,
  expectedKind: ShareRewardChannel,
  expectedLength: number,
): boolean {
  if (code.length !== expectedLength) return false;
  if (!code.startsWith(prefix)) return false;
  if (expectedKind === "REFERRAL") {
    return prefix.length === 2;
  }
  return prefix.length === 4;
}

export async function generateReferralShareCode(): Promise<string> {
  const prefix = await getEnabledReferralPrefix();
  for (let i = 0; i < 8; i += 1) {
    const code = `${prefix}${generateShareCodeSuffix(REFERRAL_SUFFIX_LENGTH)}`;
    const existing = await prisma.referralProfile.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  throw new Error("生成邀请码失败");
}

export async function generateWorkflowShareShortCode(
  app: WorkflowShareApp,
): Promise<string> {
  const prefix = await getEnabledWorkflowPrefix(app);
  for (let i = 0; i < 8; i += 1) {
    const code = `${prefix}${generateShareCodeSuffix(WORKFLOW_SUFFIX_LENGTH)}`;
    const existing = await prisma.workflowShareLink.findFirst({
      where: { shortCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  throw new Error("生成工作流分享码失败");
}

export async function resolveShareCode(raw: string): Promise<ShareCodeResolveResult> {
  const code = normalizeShareCode(raw);
  if (!code) {
    return { ok: false, message: SHARE_CODE_INVALID_MESSAGE };
  }

  const prefixRow = await findEnabledPrefixForCode(code);

  /**
   * 工作流前缀可能含字母表刻意去掉的字（如 ECOM 的 O）。
   * 以库内 shortCode 为准，不因 charset / 固定 10 位拒掉已生成的码。
   */
  if (prefixRow?.kind === "WORKFLOW" || !isValidShareCodeCharset(code)) {
    const link = await prisma.workflowShareLink.findUnique({
      where: { shortCode: code },
      include: { sharer: { select: { name: true } } },
    });
    if (link) {
      const meta = await getWorkflowSharePublicMeta(link.token);
      if (!meta || !meta.enabled) {
        return { ok: false, message: SHARE_CODE_INVALID_MESSAGE };
      }
      return {
        ok: true,
        kind: "WORKFLOW",
        code,
        title: meta.title,
        sharerName: meta.sharerName,
        app: meta.app,
      };
    }
    if (prefixRow?.kind === "WORKFLOW") {
      return { ok: false, message: SHARE_CODE_INVALID_MESSAGE };
    }
  }

  if (prefixRow?.kind === "REFERRAL" && code.length === REFERRAL_CODE_LENGTH) {
    const referrer = await resolveReferrerByCode(code);
    if (!referrer) return { ok: false, message: SHARE_CODE_INVALID_MESSAGE };
    return {
      ok: true,
      kind: "REFERRAL",
      code,
      title: "邀请注册",
      sharerName: referrer.referrerName,
      legacyReferralPath: `/r/${code}`,
    };
  }

  if (code.length === REFERRAL_CODE_LENGTH) {
    const referrer = await resolveReferrerByCode(code);
    if (referrer) {
      return {
        ok: true,
        kind: "REFERRAL",
        code,
        title: "邀请注册",
        sharerName: referrer.referrerName,
        legacyReferralPath: `/r/${code}`,
      };
    }
  }

  return { ok: false, message: SHARE_CODE_INVALID_MESSAGE };
}

export async function findWorkflowShareLinkByCode(code: string) {
  const normalized = normalizeShareCode(code);
  return prisma.workflowShareLink.findUnique({
    where: { shortCode: normalized },
  });
}
