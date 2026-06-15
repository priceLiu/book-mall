import { AppHistoryClient } from "./app-history-client";
import styles from "./expense-detail.module.css";

export default function AppHistoryPage() {
  return (
    <main className={`tw-main fitting-room-main ${styles.pageWrap}`}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>费用使用明细</h1>
        <p className={styles.pageLead}>
          Finance 2.0 · Gateway 扣减与用量明细（与 finance-web 同源）。余额为统一积分双池（通用 + 视频）。
        </p>
      </header>
      <AppHistoryClient />
    </main>
  );
}
