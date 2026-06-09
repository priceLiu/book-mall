"use client";

import { useEffect, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { FinanceRoleNav } from "@/components/finance-role-nav";
import { fetchFinanceViewer, type FinanceViewerPayload } from "@/lib/finance-viewer";
import { roleLabel } from "@/lib/permissions";
import { bookMallLoginHint } from "@/lib/book-mall-login-hint";

/** 顶栏：角色切换 + 当前用户摘要。 */
export function FinanceViewerBar({ scope }: { scope: "fees" | "team" | "admin" }) {
  const base = useBookMallBaseUrl();
  const [viewer, setViewer] = useState<FinanceViewerPayload | null | undefined>(undefined);

  useEffect(() => {
    if (!base) {
      setViewer(null);
      return;
    }
    const ac = new AbortController();
    fetchFinanceViewer(base, ac.signal).then(setViewer);
    return () => ac.abort();
  }, [base]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8e8e8] bg-white px-4 py-2">
      <FinanceRoleNav viewer={viewer ?? null} />
      <div className="text-xs text-[#8c8c8c]">
        {viewer === undefined ? (
          "加载登录态…"
        ) : viewer === null ? (
          <>
            未登录 ·{" "}
            <a
              href={base ? bookMallLoginHint(base, scope).loginUrl : "#"}
              target="_blank"
              rel="noreferrer"
              className="text-[#1890ff] underline"
            >
              去主站登录
            </a>
          </>
        ) : (
          <>
            {viewer.user.name || viewer.user.email} · {roleLabel(viewer.user.role)}
          </>
        )}
      </div>
    </div>
  );
}
