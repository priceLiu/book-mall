import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { AccountSectionHeader } from "@/components/account/account-section-header";

export const metadata = {
  title: "账户与安全 — 个人中心",
};

export default async function AccountSecurityPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const row = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  const hasPassword = Boolean(row?.passwordHash);

  return (
    <>
      <AccountSectionHeader
        title="账户与安全"
        description="登录邮箱、昵称与密码管理。"
      />
      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">账号</CardTitle>
            <CardDescription className="text-xs">登录邮箱与昵称</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <p className="flex items-baseline gap-2">
              <span className="w-12 shrink-0 text-xs text-muted-foreground">邮箱</span>
              <span className="break-all">{session.user.email}</span>
            </p>
            {session.user.name ? (
              <p className="flex items-baseline gap-2">
                <span className="w-12 shrink-0 text-xs text-muted-foreground">昵称</span>
                <span>{session.user.name}</span>
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">登录密码</CardTitle>
            <CardDescription className="text-xs">
              验证当前密码后更新（仅邮箱密码登录的账号）
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm enabled={hasPassword} />
          </CardContent>
        </Card>
      </section>
    </>
  );
}
