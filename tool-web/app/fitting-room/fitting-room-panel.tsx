"use client";

import Link from "next/link";
import { useToolsSession } from "@/components/tool-shell-client";

export function FittingRoomPanel({
  renewHref,
  mainOrigin,
}: {
  renewHref: string | null;
  mainOrigin: string | null;
}) {
  const { loading, session, hasTokenCookie, refetch } = useToolsSession();

  const originConfigured =
    typeof mainOrigin === "string" && mainOrigin.trim().length > 0;

  if (loading) {
    return (
      <p className="tw-muted" role="status">
        正在同步会话…
      </p>
    );
  }

  if (!hasTokenCookie) {
    return (
      <div className="tw-note">
        <p style={{ margin: "0 0 0.5rem" }}>
          未检测到工具站会话（<code>tools_token</code>）。请在主站登录后使用下方链接重新进入（未登录会先经过主站登录页）。
        </p>
        <p className="tw-muted" style={{ margin: "0 0 0.5rem", fontSize: "0.85rem" }}>
          若刚从主站点开却仍提示此项：请确认浏览器地址与主站配置的{" "}
          <code>TOOLS_PUBLIC_ORIGIN</code> 完全一致（例如勿混用 <code>localhost</code> 与{" "}
          <code>127.0.0.1</code>）。详见 <code>tool-web/doc/tech/sso-session-troubleshooting.md</code>
          。
        </p>
        {renewHref ? (
          <p style={{ margin: 0 }}>
            <Link href={renewHref}>从主站重新连接工具站（试衣间）</Link>
          </p>
        ) : null}
        {originConfigured ? (
          <p className="tw-muted" style={{ margin: "0.75rem 0 0", fontSize: "0.85rem" }}>
            亦可：<Link href={`${mainOrigin}/account`}>个人中心</Link>
            {" · "}
            <Link href={`${mainOrigin}/admin`}>管理后台</Link>
            （在其中点击「打开试衣间 / 工具站」）。
          </p>
        ) : null}
      </div>
    );
  }

  if (!originConfigured) {
    return (
      <div className="tw-note">
        请在本站 <code>.env.local</code> 配置 <code>MAIN_SITE_ORIGIN</code> 指向运行中的主站。
      </div>
    );
  }

  if (!session.active) {
    return (
      <div className="tw-note">
        <p style={{ margin: "0 0 0.5rem" }}>
          工具站令牌无效或已过期，或主站侧已不再满足准入。
        </p>
        <p style={{ margin: "0 0 0.5rem" }}>
          <button
            type="button"
            className="tool-renew tool-renew--link"
            onClick={() => void refetch()}
          >
            再试一次同步
          </button>
          {renewHref ? (
            <>
              {" · "}
              <Link href={renewHref}>从主站重新连接</Link>
            </>
          ) : null}
        </p>
        <p className="tw-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          <Link href={`${mainOrigin}/account`}>个人中心</Link>
          {" · "}
          <Link href={`${mainOrigin}/admin`}>管理后台</Link>
        </p>
      </div>
    );
  }

  return (
    <section className="tw-card" style={{ marginTop: "1.25rem" }}>
      <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>接入说明</h2>
      <p className="tw-muted" style={{ marginBottom: 0 }}>
        身份与权限见顶栏；可在此接入试衣业务逻辑与计费，服务端 Route 建议校验令牌或调用主站{" "}
        <code>introspect</code>。
      </p>
    </section>
  );
}
