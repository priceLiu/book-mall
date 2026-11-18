import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { canManagePricing } from "@/lib/auth/permissions";
import { GenerationHealthAdminClient } from "./generation-health-admin-client";

export const dynamic = "force-dynamic";

export default async function AdminGenerationHealthPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!canManagePricing(session.user.role)) redirect("/admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">生成健康 · 用户错误分类</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          计数来自 GatewayRequestLog（成功 + 失败四类 a/b/c/d）。用户侧文案由统一 taxonomy 生成；本页与
          Gateway 状态驾驶舱共用统计口径。管理端查原文失败请用 Gateway 日志或平台错误日志。
        </p>
      </div>
      <GenerationHealthAdminClient />
    </div>
  );
}