import { gatewayJson } from "@/lib/gateway-api";
import { LogsTable, type GatewayLogRow } from "@/components/logs/logs-table";

export const dynamic = "force-dynamic";

export default async function DashboardLogsPage() {
  const { data } = await gatewayJson<{ logs: GatewayLogRow[] }>(
    "/api/gateway/logs?limit=50",
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white">Logs</h1>
        <p className="mt-1 text-sm text-zinc-500">
          最近 50 条 · 悬停 Params / Result / failed 状态查看详情
        </p>
      </div>

      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-amber-100/90">
        日志保留策略以站点配置为准。若 Canvas 复用了旧任务缓存，不会产生新日志——请点
        「重新生成」或修改 prompt 后再跑。新请求会记录完整 Params 与 Results 预览。
      </div>

      <LogsTable logs={data?.logs ?? []} />
    </div>
  );
}
