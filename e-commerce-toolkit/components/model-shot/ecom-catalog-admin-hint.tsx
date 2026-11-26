"use client";

import Link from "next/link";

import { getBookOriginClient } from "@/lib/ecom-auth";
import { useEcomToolsAdmin } from "@/lib/ecom-tools-admin.client";

type EcomCatalogAdminHintProps = {
  /** Book 管理后台路径（不含 origin），如 `/admin/templates?tab=ecom` */
  adminPath: string;
  adminLabel: string;
};

export function EcomCatalogAdminHint({ adminPath, adminLabel }: EcomCatalogAdminHintProps) {
  const isAdmin = useEcomToolsAdmin();
  if (!isAdmin) return null;

  const href = `${getBookOriginClient().replace(/\/$/, "")}${adminPath.startsWith("/") ? adminPath : `/${adminPath}`}`;

  return (
    <div className="mb-4 rounded-xl border border-[var(--ecom-outline-border)] bg-[var(--ecom-content-selected-bg)] px-4 py-3 text-sm text-[var(--ecom-ink)]">
      <p>
        你是平台管理员：此页「系统推荐」对所有人只读。要增删改平台推荐条目，请前往 Book 管理后台的
        <Link href={href} className="mx-1 text-[var(--ecom-primary)] hover:underline" target="_blank" rel="noreferrer">
          {adminLabel}
        </Link>
        。
      </p>
    </div>
  );
}
