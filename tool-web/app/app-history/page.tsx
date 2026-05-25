import { AppHistoryClient } from "./app-history-client";
import styles from "./expense-detail.module.css";

export default function AppHistoryPage() {
  return (
    <main className={`tw-main fitting-room-main ${styles.pageWrap}`}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>费用使用明细</h1>
        <p className={styles.pageLead}>
          展示已成功入库的<strong>扣费</strong>流水（每页 50 条，可翻页）。页首与页尾为实时钱包余额；未标价事件显示「—」。
        </p>
      </header>
      <AppHistoryClient />
    </main>
  );
}
