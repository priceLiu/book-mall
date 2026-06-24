import {
  LogsTable,
  type GatewayLogsInitialData,
} from "@/components/logs/logs-table";

/** 日志列表改由客户端拉取，避免 DB 繁忙时 SSR 阻塞整页 30–60s */
const EMPTY_INITIAL: GatewayLogsInitialData = {
  logs: [],
  total: 0,
  page: 1,
  pageSize: 30,
  totalPages: 1,
};

export default function DashboardLogsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="shrink-0">
        <h1 className="text-xl font-semibold text-[var(--gw-ink)]">Logs</h1>
        <p className="mt-1 text-sm text-[var(--gw-muted)]">
          默认「实时」仅显示在飞 + 近 1 小时内完成；「历史」查归档明细。有进行中任务时自动刷新并轮询厂商。
        </p>
      </div>

      <div className="shrink-0 rounded-md border border-[var(--gw-border)] bg-[var(--gw-surface)] px-4 py-3 text-xs leading-relaxed text-[var(--gw-muted)]">
        日志保留策略以站点配置为准。若 Canvas 复用了旧任务缓存，不会产生新日志——请点
        「重新生成」或修改 prompt 后再跑。新请求会记录完整 Params 与 Results 预览。
      </div>

      <LogsTable initialData={EMPTY_INITIAL} />
    </div>
  );
}
