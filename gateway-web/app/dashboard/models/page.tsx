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
  platformPoolDelegate?: { canonicalOwnerEmail: string } | null;
};

export default async function DashboardModelsPage() {
  const [catalogRes, credRes] = await Promise.all([
    gatewayJson<CatalogResponse>("/api/gateway/models"),
    gatewayJson<CredentialsResponse>("/api/gateway/credentials"),
  ]);

  const catalog = catalogRes.data;
  const credentials = credRes.data?.credentials ?? [];
  const platformPoolDelegate = credRes.data?.platformPoolDelegate ?? null;

  const tabGroups: Record<ModelTab, CatalogGroup[]> = catalog?.tabs ?? {
    text: catalog?.groups ?? [],
    image: [],
    video: [],
    function: [],
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--gw-ink)]">模型管理</h1>
        <p className="mt-1 text-sm text-[var(--gw-muted)]">
          绑定厂商 API Key、测试连接并管理可用模型。Canvas · Story · 工具站 ·
          提示词优化器经 Gateway 统一路由。
        </p>
      </div>

      {platformPoolDelegate ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-[var(--gw-accent)]">
          正在代管平台共用凭证池（canonical:{" "}
          <span className="font-mono text-xs">{platformPoolDelegate.canonicalOwnerEmail}</span>
          ）。此处增删改会直接影响平台代付用户的 AI 调用。
        </div>
      ) : null}

      <ModelManager
        initialGroups={catalog?.groups ?? []}
        initialCredentials={credentials}
        tabGroups={tabGroups}
      />
    </div>
  );
}
