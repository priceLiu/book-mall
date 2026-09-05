import { gatewayJson } from "@/lib/gateway-api";
import { MarketListClient } from "@/components/market/market-list-client";
import type { MarketListResponse } from "@/lib/market-types";

export const dynamic = "force-dynamic";

export default async function MarketPage() {
  const { ok, data } = await gatewayJson<MarketListResponse>(
    "/api/gateway/market/models?page=1&pageSize=20",
  );

  const empty: MarketListResponse = {
    models: [],
    featured: [],
    providers: [],
    tasks: [],
    heroSlides: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  };

  // 未登录等错误体也是 truthy JSON（{ error }），不可用 data ?? empty
  const initial =
    ok && data && Array.isArray(data.providers) ? data : empty;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[var(--gw-ink)]">Models Market</h1>
        <p className="mt-1 text-sm text-[var(--gw-muted)]">
          浏览已上架模型 · 筛选厂商与任务类型 · 点击进入 Playground 试跑（经 Gateway 扣费 / BYOK）
        </p>
      </div>
      <MarketListClient initial={initial} />
    </div>
  );
}
