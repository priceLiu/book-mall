import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { canManagePricing } from "@/lib/auth/permissions";
import { SmsLogsAdminClient } from "./sms-logs-admin-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "短信发送日志 — 管理后台",
};

export default async function AdminSmsLogsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!canManagePricing(session.user.role)) redirect("/admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">短信发送日志</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          记录每次发码请求：手机号、来源、验证码、腾讯云回执与失败原因。验证码明文仅管理员可见，请勿外泄。
        </p>
      </div>
      <SmsLogsAdminClient />
    </div>
  );
}
