import { AppHistoryClient } from "./app-history-client";

export default function AppHistoryPage() {
  return (
    <main className="tw-main fitting-room-main">
      <h1 style={{ marginTop: 0 }}>应用历史</h1>
      <p className="tw-muted" style={{ marginBottom: "1.25rem" }}>
        按工具汇总使用情况：使用次数、合计消耗与最近使用时间；点「明细」可展开最近的事件流水。AI 试衣「成片」会先写入自有 OSS，再在详情中记录稳定链接。
      </p>
      <AppHistoryClient />
    </main>
  );
}
