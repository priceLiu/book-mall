"use client";

import Link from "next/link";
import { useToolsSession } from "@/components/tool-shell-client";

export function TextToImagePanel({
  renewHref,
  mainOrigin,
}: {
  renewHref: string | null;
  mainOrigin: string | null;
}) {
  const { loading, session } = useToolsSession();

  const originConfigured =
    typeof mainOrigin === "string" && mainOrigin.trim().length > 0;

  if (loading) {
    return (
      <p className="tw-muted" role="status">
        正在同步会话…
      </p>
    );
  }

  if (!session.active) {
    return (
      <div className="tw-note">
        <p style={{ margin: "0 0 0.5rem" }}>
          需要先通过主站重新连接工具站（令牌过期或未登录时会先到主站登录）。管理员可从后台「工具站」进入。
        </p>
        {renewHref ? (
          <p style={{ margin: "0 0 0.5rem" }}>
            <Link href={renewHref}>从主站重新连接工具站（返回本页）</Link>
          </p>
        ) : null}
        {originConfigured ? (
          <p className="tw-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            <Link href={`${mainOrigin}/account`}>个人中心</Link>
            {" · "}
            <Link href={`${mainOrigin}/admin`}>管理后台</Link>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <p className="tw-muted" style={{ margin: "0.75rem 0 0", maxWidth: "36rem" }}>
      生成入口建设中。已保存的成片请在侧边栏「
      <Link href="/text-to-image/library">我的图片库</Link>
      」查看。
    </p>
  );
}
