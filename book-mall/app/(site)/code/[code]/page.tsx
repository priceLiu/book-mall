import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import {
  resolveShareCode,
  SHARE_CODE_INVALID_MESSAGE,
} from "@/lib/share/share-code-service";
import {
  claimWorkflowShare,
  workflowShareAbsoluteRedirectUrl,
} from "@/lib/share/workflow-share-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "分享码兑换 — AI Mall",
};

export default async function ShareCodeRedeemPage({
  params,
}: {
  params: { code: string };
}) {
  const raw = params.code ?? "";
  const resolved = await resolveShareCode(raw);

  if (!resolved.ok) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-[#1f2328]">无法兑换</h1>
        <p className="mt-3 text-sm text-[#656d76]">{SHARE_CODE_INVALID_MESSAGE}</p>
        <Link
          href="/code"
          className="mt-6 inline-flex rounded-lg bg-[#8957e5] px-4 py-2 text-sm text-white hover:bg-[#7c4fd6]"
        >
          重新输入
        </Link>
      </main>
    );
  }

  if (resolved.kind === "REFERRAL") {
    redirect(`/register?referralCode=${encodeURIComponent(resolved.code)}`);
  }

  const session = await getServerSession(authOptions);
  const callback = `/code/${encodeURIComponent(resolved.code)}`;
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callback)}`);
  }

  try {
    const result = await claimWorkflowShare({
      shortCode: resolved.code,
      claimerUserId: session.user.id,
    });
    redirect(
      workflowShareAbsoluteRedirectUrl(
        result.app,
        result.clonedResourceId,
        result.resourceType,
      ),
    );
  } catch {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-[#1f2328]">无法领取工作流</h1>
        <p className="mt-3 text-sm text-[#656d76]">{SHARE_CODE_INVALID_MESSAGE}</p>
        <Link
          href="/code"
          className="mt-6 inline-flex rounded-lg bg-[#8957e5] px-4 py-2 text-sm text-white hover:bg-[#7c4fd6]"
        >
          返回
        </Link>
      </main>
    );
  }
}
