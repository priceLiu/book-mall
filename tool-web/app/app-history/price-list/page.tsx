import type { Metadata } from "next";
import Link from "next/link";
import { PriceListClient } from "./price-list-client";
import styles from "./price-list.module.css";

export const metadata: Metadata = {
  title: "价格表",
  description:
    "工具站各计费工具的当前按次标价（点 / 元），与主站「工具管理 → 按次单价」及费用明细扣费一致。",
};

export default function PriceListPage() {
  return (
    <main className="tw-main fitting-room-main">
      <h1 style={{ marginTop: 0 }}>价格表</h1>
      <p className={styles.pageIntro}>
        下列为当前<strong>生效中</strong>的按次标价（<strong>1 点 = ¥0.01</strong>
        ，与钱包余额单位一致）。单次实际扣费以发起成功后的流水为准；规则与免责详见
        <Link href="/app-history/plan-rules">计费规则说明</Link>。
      </p>
      <nav className={styles.linksRow} aria-label="费用相关页面">
        <Link href="/app-history">费用使用明细</Link>
        <Link href="/app-history/plan-rules">计费规则说明</Link>
      </nav>
      <PriceListClient />
    </main>
  );
}
