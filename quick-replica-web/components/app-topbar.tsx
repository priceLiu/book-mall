"use client";

import { getGatewayWebOrigin, getMainSiteOrigin } from "@/lib/site-origin";

export function AppTopbar() {
  const main = getMainSiteOrigin();
  const gateway = getGatewayWebOrigin();

  return (
    <header className="po-topbar">
      <div className="po-topbar-title">QuickReplica · 快速复制</div>
      <nav className="po-topbar-links">
        {main ? (
          <a href={`${main}/account`} target="_blank" rel="noreferrer">
            主站账户
          </a>
        ) : null}
        {gateway ? (
          <a href={`${gateway}/dashboard/models`} target="_blank" rel="noreferrer">
            Gateway 模型管理
          </a>
        ) : null}
      </nav>
    </header>
  );
}
