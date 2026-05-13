import { readFileSync } from "fs";
import path from "path";
import type { Metadata } from "next";
import {
  PlanRulesDocument,
  parsePlanRulesMarkdown,
} from "./parse-plan-rules-md";
import styles from "./plan-rules.module.css";

export const metadata: Metadata = {
  title: "计费规则说明",
  description:
    "工具站计费计划规则、免责提示与费用口径公示（充值、明细、AI 试衣、文生图等）。",
};

export default function PlanRulesPage() {
  const fp = path.join(process.cwd(), "doc/product/billing-plan-rules.md");
  const raw = readFileSync(fp, "utf8");
  const parsed = parsePlanRulesMarkdown(raw);

  return (
    <main className={`tw-main fitting-room-main ${styles.page}`}>
      <div className={styles.pageInner}>
        <h1 className={styles.pageTitle}>{parsed.pageTitle}</h1>
        <PlanRulesDocument parsed={parsed} />
      </div>
    </main>
  );
}
