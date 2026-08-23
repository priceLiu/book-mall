import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { canManagePricing } from "@/lib/auth/permissions";
import { AdminGatewayHealthPanel } from "@/components/admin/admin-gateway-health-panel";
import { getGatewayPublicOrigin } from "@/lib/gateway/env";
import { scanGatewayHealth } from "@/lib/gateway/gateway-health-service";

export const dynamic = "force-dynamic";

export default async function AdminGatewayHealthPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!canManagePricing(session.user.role)) redirect("/admin");

  const snapshot = await scanGatewayHealth({ source: "admin-page" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gateway 阻塞预警</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          每 10 分钟自动扫描在飞任务。CHAT 漏收口（≥15 分钟、无厂商 taskId）会自动关闭；
          「一键修复」还会跑视频/KIE 看门狗、画布排队自愈和在飞计数纠偏。不会误杀仍在流式输出的
          10 分钟内 Chat，也不会对厂商仍在跑的视频盲杀。
        </p>
      </div>
      <AdminGatewayHealthPanel
        initial={snapshot}
        gatewayOrigin={getGatewayPublicOrigin()}
      />
    </div>
  );
}
