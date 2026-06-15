import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

import { TeamInviteClient } from "@/components/team/team-invite-client";
import { InviteStaleSessionCleaner } from "@/components/team/invite-stale-session-cleaner";
import { authOptions } from "@/lib/auth";
import { normalizePhone } from "@/lib/auth/phone";
import { getInviteByToken } from "@/lib/tenant/tenant-invite-service";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "团队邀请 — AI Mall",
};

function pickInviteCode(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  storedUrlCode: string | null | undefined,
): string | null {
  const raw = searchParams?.code;
  const fromQuery = Array.isArray(raw) ? raw[0] : raw;
  const q = fromQuery?.trim();
  if (q) return q;
  const stored = storedUrlCode?.trim();
  return stored || null;
}

export default async function TeamInvitePage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const invite = await getInviteByToken(params.token);
  if (!invite || invite.tenant.type !== "TEAM") notFound();

  const session = await getServerSession(authOptions);
  let userPhone: string | null = null;
  if (session?.user?.id) {
    const u = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { phone: true },
    });
    userPhone = u?.phone ?? session.user.phone ?? null;
  }

  const existingUser = await prisma.user.findUnique({
    where: { phone: invite.phone },
    select: { phoneVerifiedAt: true },
  });
  const userExists = Boolean(existingUser?.phoneVerifiedAt);
  const inviteCode = pickInviteCode(searchParams, invite.urlCode);

  const normalizedInvitePhone = normalizePhone(invite.phone);
  const normalizedUserPhone = normalizePhone(userPhone);
  const phonesMatch =
    Boolean(normalizedUserPhone) &&
    Boolean(normalizedInvitePhone) &&
    normalizedUserPhone === normalizedInvitePhone;

  /** 浏览器 Cookie 可能是其他账号；仅手机号与邀请一致时才视为已登录。 */
  const hasStaleSession = Boolean(session?.user?.id) && !phonesMatch;
  const effectiveLoggedIn = Boolean(session?.user?.id && phonesMatch);

  return (
    <>
      <InviteStaleSessionCleaner enabled={hasStaleSession} />
      <Suspense
        fallback={
          <p className="py-16 text-center text-sm text-muted-foreground">加载中…</p>
        }
      >
        <TeamInviteClient
          token={params.token}
          tenantName={invite.tenant.name}
          invitePhone={invite.phone}
          inviteStatus={invite.status}
          inviteCode={inviteCode}
          userExists={userExists}
          isLoggedIn={effectiveLoggedIn}
          hasStaleSession={hasStaleSession}
        />
      </Suspense>
    </>
  );
}
