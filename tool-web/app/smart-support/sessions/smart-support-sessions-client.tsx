"use client";

import Link from "next/link";
import { ToolImplementationCrossLink } from "@/components/tool-implementation-crosslink";

export function SmartSupportSessionsClient() {
  return (
    <div className="tw-card" style={{ padding: "2rem 1.5rem", textAlign: "center" }}>
      <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.35rem" }}>我的智能客服</h1>
      <ToolImplementationCrossLink href="/smart-support/implementation" />
      <p className="tw-muted" style={{ margin: "1rem 0 0", maxWidth: "28rem", marginInline: "auto" }}>
        会话归档与检索正在接入：届时可在此查看历史工单式摘要与追问记录。
      </p>
      <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
        <Link
          href="/smart-support/chat"
          className="inline-flex items-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          进入我的智能客服
        </Link>
        <Link
          href="/smart-support"
          className="inline-flex items-center rounded-md border border-input bg-background px-5 py-2.5 text-sm font-medium hover:bg-accent"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
