import { AppHistoryClient } from "./app-history-client";

export default function AppHistoryPage() {
  return (
    <main className="tw-main fitting-room-main">
      <h1 style={{ marginTop: 0 }}>费用使用明细</h1>
      <p className="tw-muted" style={{ marginBottom: "1.25rem" }}>
        顶部与底部均为实时钱包余额（来自主站准入校验）；中间为逐页展示的打点<strong>扣费</strong>明细，**每页 50 条**（多于 50 条时翻页查看）。未写入计费金额的事件显示「—」。
      </p>
      <AppHistoryClient />
    </main>
  );
}
