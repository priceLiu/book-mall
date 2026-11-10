import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { canManagePricing } from "@/lib/auth/permissions";
import { PlatformErrorsAdminClient } from "./platform-errors-admin-client";

export const dynamic = "force-dynamic";

export default async function AdminPlatformErrorsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!canManagePricing(session.user.role)) redirect("/admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">平台错误日志</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Canvas / Gateway 等运行时失败会自动写入；5 分钟内相同指纹合并计数。先用「类别」区分
          系统运维、积分对账与模型 Gateway；业务侧再用「应用」筛选。Gateway 详细请求仍见
          Gateway 控制台 Logs。
        </p>
      </div>
      <PlatformErrorsAdminClient />
    </div>
  );
}
