import {
  LogsTable,
  type GatewayLogsInitialData,
} from "@/components/logs/logs-table";

/** 日志列表改由客户端拉取，避免 DB 繁忙时 SSR 阻塞整页 30–60s */
const EMPTY_INITIAL: GatewayLogsInitialData = {
  logs: [],
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 1,
};

export default function DashboardLogsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="shrink-0">
        <h1 className="text-xl font-semibold text-white">Logs</h1>
        <p className="mt-1 text-sm text-zinc-500">
          分页浏览 · 每页 20 / 50 / 100 或自定义 · 可按应用 / 厂商 / 模型 / 提交日期筛选 · 有进行中任务时每 8 秒自动刷新进度 · 表头「Canvas 排队」为尚无 Gateway log 的画布视频任务数
        </p>
      </div>

      <div className="shrink-0 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-amber-100/90">
        日志保留策略以站点配置为准。若 Canvas 复用了旧任务缓存，不会产生新日志——请点
        「重新生成」或修改 prompt 后再跑。新请求会记录完整 Params 与 Results 预览。
      </div>

      <LogsTable initialData={EMPTY_INITIAL} />
    </div>
  );
}
