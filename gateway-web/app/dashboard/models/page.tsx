import Link from "next/link";

import { ModelsCatalog, type CatalogGroup } from "@/components/models/models-catalog";
import { gatewayJson } from "@/lib/gateway-api";

export const dynamic = "force-dynamic";

type CatalogResponse = {
  groups: CatalogGroup[];
  totalCount: number;
  boundKinds: string[];
};

export default async function DashboardModelsPage() {
  const { data } = await gatewayJson<CatalogResponse>("/api/gateway/models");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">接入模型</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Gateway 当前支持路由的全部 modelKey（Canvas · Story · 工具站经 sk-gw 调用）。
          绑定对应厂商凭证后，该厂商下的模型即可使用。
        </p>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-xs leading-relaxed text-zinc-400">
        模型清单来自服务端常量（KIE / DeepSeek / 百炼 / DashScope / 混元），与各产品节点选项保持一致。
        若需新增模型，请在 book-mall Provider 常量或工具站配置中维护后重新部署。
        {" "}
        <Link
          href="/dashboard/credentials"
          className="text-zinc-200 underline underline-offset-2 hover:text-white"
        >
          厂商凭证 →
        </Link>
      </div>

      <ModelsCatalog
        groups={data?.groups ?? []}
        totalCount={data?.totalCount ?? 0}
        boundKinds={data?.boundKinds ?? []}
      />
    </div>
  );
}
