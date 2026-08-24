import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { AdminLoggingConfigClient } from "@/components/admin/admin-logging-config-client";
import { authOptions } from "@/lib/auth";
import { canManagePricing } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "日志与保险丝配置 — 管理后台",
};

export default async function AdminLoggingConfigPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!canManagePricing(session.user.role)) redirect("/admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">日志与保险丝配置</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          管理平台可观测性与用量保险丝：<strong className="text-foreground">单模型日调用上限</strong>、
          <strong className="text-foreground">厂商直连出口审计 / 阻断</strong>、
          <strong className="text-foreground">常驻用量对账</strong>。
          保存后约 <strong className="text-foreground">30 秒</strong>内生效（进程内缓存），无需重启。
          配置存于 <code>PlatformConfig</code>；环境变量仅作回退。
        </p>
      </div>
      <AdminLoggingConfigClient />
    </div>
  );
}
