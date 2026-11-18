import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import {
  aiLegalConsentBodySchema,
  buildAiLegalConsentUpdate,
  isAiLegalConsentComplete,
} from "@/lib/auth/ai-legal-consent";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tryApiDbUnavailableResponse } from "@/lib/http/api-db-error";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      aiUserAgreementAcceptedAt: true,
      aiAppPermissionsAcceptedAt: true,
      aiPrivacyPolicyAcceptedAt: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }
  return NextResponse.json({
    complete: isAiLegalConsentComplete(user),
    userAgreementAt: user.aiUserAgreementAcceptedAt?.toISOString() ?? null,
    appPermissionsAt: user.aiAppPermissionsAcceptedAt?.toISOString() ?? null,
    privacyPolicyAt: user.aiPrivacyPolicyAcceptedAt?.toISOString() ?? null,
  });
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const json = await request.json();
    const parsed = aiLegalConsentBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "请勾选并同意全部法律文档" },
        { status: 400 },
      );
    }

    const existing = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        aiUserAgreementAcceptedAt: true,
        aiAppPermissionsAcceptedAt: true,
        aiPrivacyPolicyAcceptedAt: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    const patch = buildAiLegalConsentUpdate(existing, parsed.data);
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: true, complete: true, unchanged: true });
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: patch,
      select: {
        aiUserAgreementAcceptedAt: true,
        aiAppPermissionsAcceptedAt: true,
        aiPrivacyPolicyAcceptedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      complete: isAiLegalConsentComplete(updated),
      userAgreementAt: updated.aiUserAgreementAcceptedAt?.toISOString() ?? null,
      appPermissionsAt: updated.aiAppPermissionsAcceptedAt?.toISOString() ?? null,
      privacyPolicyAt: updated.aiPrivacyPolicyAcceptedAt?.toISOString() ?? null,
    });
  } catch (e) {
    const dbResp = tryApiDbUnavailableResponse(e);
    if (dbResp) return dbResp;
    console.error("[legal-consent]", e);
    return NextResponse.json({ error: "保存失败" }, { status: 500 });
  }
}