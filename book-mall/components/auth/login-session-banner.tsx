import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { bookMallFullSignOutHref } from "@/lib/session-kicked-marker";

function formatUserLabel(input: {
  phone?: string | null;
  email?: string | null;
  name?: string | null;
}): string {
  if (input.phone?.trim()) return input.phone.trim();
  if (input.name?.trim()) return input.name.trim();
  if (input.email?.trim()) return input.email.trim();
  return "当前账号";
}

export async function LoginSessionBanner() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const label = formatUserLabel(session.user);
  const needsBindPhone = !session.user.phoneVerified;

  return (
    <div
      className="rounded-lg border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100"
      role="status"
    >
      <p>
        当前浏览器已登录为 <span className="font-semibold">{label}</span>
        。无痕窗口内若曾登录过，也会保持该状态；要换账号请先退出。
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <Link
          href="/account"
          className="font-medium text-amber-900 underline underline-offset-2 dark:text-amber-200"
        >
          进入个人中心
        </Link>
        {needsBindPhone ? (
          <Link
            href="/onboarding/bind-phone"
            className="font-medium text-amber-900 underline underline-offset-2 dark:text-amber-200"
          >
            绑定手机号
          </Link>
        ) : null}
        <a
          href={bookMallFullSignOutHref("/login")}
          className="font-medium text-amber-900 underline underline-offset-2 dark:text-amber-200"
        >
          退出并换账号
        </a>
      </div>
    </div>
  );
}
