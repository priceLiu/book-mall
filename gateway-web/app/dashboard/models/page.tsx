import { ModelsPageClient } from "@/components/model-manager/models-page-client";

export const dynamic = "force-dynamic";

export default function DashboardModelsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--gw-ink)]">模型管理</h1>
        <p className="mt-1 text-sm text-[var(--gw-muted)]">
          绑定厂商 API Key、测试连接并管理可用模型。Canvas · Story · 工具站 ·
          提示词优化器经 Gateway 统一路由。
        </p>
      </div>

      <ModelsPageClient />
    </div>
  );
}
