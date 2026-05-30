import { ModelManager } from "@/components/model-manager/model-manager";
import type { CatalogGroup, CredentialRow, ModelTab } from "@/components/model-manager/types";
import { gatewayJson } from "@/lib/gateway-api";

export const dynamic = "force-dynamic";

type CatalogResponse = {
  groups: CatalogGroup[];
  totalCount: number;
  boundKinds: string[];
  tabs?: Record<ModelTab, CatalogGroup[]>;
};

type CredentialsResponse = {
  credentials: CredentialRow[];
};

export default async function DashboardModelsPage() {
  const [catalogRes, credRes] = await Promise.all([
    gatewayJson<CatalogResponse>("/api/gateway/models"),
    gatewayJson<CredentialsResponse>("/api/gateway/credentials"),
  ]);

  const catalog = catalogRes.data;
  const credentials = credRes.data?.credentials ?? [];

  const tabGroups: Record<ModelTab, CatalogGroup[]> = catalog?.tabs ?? {
    text: catalog?.groups ?? [],
    image: [],
    function: [],
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">模型管理</h1>
        <p className="mt-1 text-sm text-zinc-500">
          绑定厂商 API Key、测试连接并管理可用模型。Canvas · Story · 工具站 ·
          提示词优化器经 Gateway 统一路由。
        </p>
      </div>

      <ModelManager
        initialGroups={catalog?.groups ?? []}
        initialCredentials={credentials}
        tabGroups={tabGroups}
      />
    </div>
  );
}
