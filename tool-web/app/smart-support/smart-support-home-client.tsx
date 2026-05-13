"use client";

import Link from "next/link";
import { SmartSupportHero } from "@/components/ui/hero-smart-support";
import { ToolImplementationCrossLink } from "@/components/tool-implementation-crosslink";
import { useToolsSession } from "@/components/tool-shell-client";

export function SmartSupportHomeClient({
  renewHref,
  mainOrigin,
}: {
  renewHref: string | null;
  mainOrigin: string | null;
}) {
  const { loading, session } = useToolsSession();
  const originConfigured =
    typeof mainOrigin === "string" && mainOrigin.trim().length > 0;

  return (
    <>
      <SmartSupportHero panelAnchorId="smart-support-panel" />

      <section id="smart-support-panel" aria-labelledby="smart-support-heading">
        <h1 id="smart-support-heading" style={{ marginTop: 0 }}>
          AI智能客服
        </h1>
        <ToolImplementationCrossLink href="/smart-support/implementation" />

        {loading ? (
          <p className="tw-muted" role="status">
            正在同步会话…
          </p>
        ) : !session.active ? (
          <div className="tw-note" style={{ marginTop: "0.75rem" }}>
            <p style={{ margin: "0 0 0.5rem" }}>
              使用 AI智能客服前请先通过主站登录并进入工具站（令牌过期时需重新连接）。
            </p>
            {renewHref ? (
              <p style={{ margin: "0 0 0.5rem" }}>
                <Link href={renewHref}>从主站重新连接工具站</Link>
              </p>
            ) : null}
            {originConfigured ? (
              <p className="tw-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                <Link href={`${mainOrigin}/account`}>个人中心</Link>
              </p>
            ) : null}
          </div>
        ) : (
          <div style={{ marginTop: "0.75rem", maxWidth: "36rem" }}>
            <p className="tw-muted" style={{ margin: "0 0 1rem", lineHeight: 1.6 }}>
              在「我的智能客服」中与 DeepSeek、Dify 双通道交流（详见侧栏入口）。会话归档能力建设中。
            </p>
            <Link
              href="/smart-support/chat"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-base font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              进入我的智能客服
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
