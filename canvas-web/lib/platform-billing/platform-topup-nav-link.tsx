/** @generated — 勿手改；改 shared/platform-billing 后运行 node scripts/sync-platform-billing.mjs */

"use client";

import { buildAppRechargeEntryHref } from "./build-app-topup-href";

type PlatformTopupNavLinkProps = {
  bookOrigin: string;
  className?: string;
  label?: string;
};

/** 各应用顶栏 · 积分充值（新标签页 → 主站分流：轻量包 / 订阅续费） */
export function PlatformTopupNavLink({
  bookOrigin,
  className,
  label = "积分充值",
}: PlatformTopupNavLinkProps) {
  const base = bookOrigin.replace(/\/$/, "");
  return (
    <a
      href={`${base}/account/recharge`}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={(e) => {
        e.preventDefault();
        window.open(
          buildAppRechargeEntryHref(bookOrigin),
          "_blank",
          "noopener,noreferrer",
        );
      }}
    >
      {label}
    </a>
  );
}
