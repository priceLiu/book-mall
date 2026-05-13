import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMembershipFlags } from "@/lib/membership";
import { getGoldMemberAccess } from "@/lib/gold-member";
import { isToolsSsoConfigured } from "@/lib/sso-tools-env";
import { Button } from "@/components/ui/button";
import { LaunchToolsAppButton } from "@/components/account/launch-tools-app";
import { NavbarSignOutButton } from "./navbar-sign-out-button";

export async function NavbarAuth() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return (
      <div className="flex h-9 flex-wrap items-center justify-end gap-2">
        <Button asChild variant="ghost" size="sm" className="h-9 px-3">
          <Link href="/login">登录</Link>
        </Button>
        <Button asChild size="sm" className="h-9 px-3">
          <Link href="/register">注册</Link>
        </Button>
      </div>
    );
  }

  const userId = session.user.id;
  const [flags, goldAccess] = await Promise.all([
    getMembershipFlags(userId),
    getGoldMemberAccess(userId),
  ]);

  const toolsSsoReady = isToolsSsoConfigured();
  const isAdminUser = session.user.role === "ADMIN";
  const canLaunchTools =
    toolsSsoReady &&
    (isAdminUser ||
      (goldAccess.isGoldMember &&
        (flags.hasActiveSubscription || flags.hasActiveToolProductSubscription)));

  const showCoursesCta =
    flags.hasActiveSubscription || flags.hasActiveCourseProductSubscription;
  const showToolsCta = canLaunchTools;

  return (
    <div className="flex h-9 flex-wrap items-center justify-end gap-2">
      {isAdminUser ? (
        <Button asChild variant="ghost" size="sm" className="hidden h-9 shrink-0 px-3 sm:inline-flex">
          <Link href="/admin">管理后台</Link>
        </Button>
      ) : null}
      {showCoursesCta ? (
        <Button asChild variant="subscription" size="sm" className="h-9 shrink-0 px-3">
          <Link href="/courses">AI 课程</Link>
        </Button>
      ) : null}
      {showToolsCta ? (
        <LaunchToolsAppButton
          layout="inlineNav"
          variant="subscription"
          enabled={canLaunchTools}
          label="AI 工具"
          openInNewTab
        />
      ) : null}
      <Button asChild variant="subscription" size="sm" className="h-9 shrink-0 px-3">
        <Link href="/account/subscription">订阅中心</Link>
      </Button>
      <Button asChild variant="ghost" size="sm" className="h-9 shrink-0 px-3">
        <Link href="/account">个人中心</Link>
      </Button>
      <NavbarSignOutButton />
    </div>
  );
}
