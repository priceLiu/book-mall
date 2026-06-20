"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  FinanceTokenUsageHeaderCells,
  FinanceTokenUsageRowCells,
  type FinanceTokenUsage,
} from "@/components/admin/finance-token-usage-columns";
import { FinancePageShell } from "@/components/finance-page-shell";
import { bookMallLoginHint } from "@/lib/book-mall-login-hint";
import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";

type BillingUser = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  lineCount: number;
  succeededCalls?: number;
  latestAt: string | null;
  tokenUsage: FinanceTokenUsage;
};

type BillingUsersResponse = {
  users: BillingUser[];
  periodKey: string;
};

export default function AdminBillingUsersIndexPage() {
  const base = useBookMallBaseUrl();
  const [users, setUsers] = useState<BillingUser[] | null>(null);
  const [periodKey, setPeriodKey] = useState<string>("");
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!base) {
      setLoadState("error");
      setHint("未配置 NEXT_PUBLIC_BOOK_MALL_URL，无法拉取用户列表。");
      return;
    }
    let cancelled = false;
    setLoadState("loading");
    const { url, init } = resolveBookMallBrowserRequest(base, "/api/admin/finance/billing-users");
    fetch(url, init)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 403) {
          setLoadState("error");
          setHint(bookMallLoginHint(base, "admin").text);
          return;
        }
        if (!res.ok) {
          setLoadState("error");
          setHint(`接口错误 HTTP ${res.status}`);
          return;
        }
        const data = (await res.json()) as BillingUsersResponse;
        setUsers(data.users);
        setPeriodKey(data.periodKey);
        setLoadState("ok");
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadState("error");
        setHint(`请求失败：${(e as Error).message}`);
      });
    return () => {
      cancelled = true;
    };
  }, [base]);

  return (
    <FinancePageShell>
      <h1 className="text-lg font-medium text-[#262626]">有 Gateway 调用或账单的用户</h1>
      <p className="text-sm text-[#8c8c8c]">
        含成功与失败调用；仅注册、从未调用 Gateway 的用户不在此列表。团队扣费请同时看「团队驾驶舱」。
        {periodKey ? ` Gateway 用量列统计账期 ${periodKey}（张/秒/千Token）。` : null}
      </p>

      {loadState === "loading" && (
        <p className="text-sm text-[#8c8c8c]">正在加载…</p>
      )}

      {loadState === "error" && (
        <div className="rounded border border-[#ffccc7] bg-[#fff2f0] p-3 text-sm text-[#a8071a]">
          {hint ?? "加载失败"}
          <div className="mt-2 text-xs text-[#595959]">
            或者你可以直接在 URL 里填入用户 id，例如{" "}
            <code className="rounded bg-white px-1 text-[#262626]">
              /admin/billing/users/&lt;book-mall User.id&gt;
            </code>
          </div>
        </div>
      )}

      {loadState === "ok" && users && users.length === 0 && (
        <p className="text-sm text-[#8c8c8c]">暂无有 Gateway 调用或账单明细的用户。</p>
      )}

      {loadState === "ok" && users && users.length > 0 && (
        <div className="overflow-x-auto rounded border border-[#e8e8e8] bg-white">
          <table className="w-full min-w-[2200px] border-collapse text-sm">
            <thead>
              <tr className="bg-[#fafafa] text-left text-[#595959]">
                <th className="border border-[#e8e8e8] px-3 py-2">用户</th>
                <th className="border border-[#e8e8e8] px-3 py-2">手机号</th>
                <th className="border border-[#e8e8e8] px-3 py-2">邮箱</th>
                <th className="border border-[#e8e8e8] px-3 py-2">Gateway 调用</th>
                <th className="border border-[#e8e8e8] px-3 py-2">成功次数</th>
                <FinanceTokenUsageHeaderCells />
                <th className="border border-[#e8e8e8] px-3 py-2">最近一条</th>
                <th className="border border-[#e8e8e8] px-3 py-2">查看明细</th>
              </tr>
            </thead>
            <tbody className="text-[#262626]">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-[#fafafa]">
                  <td className="border border-[#e8e8e8] px-3 py-2 font-medium">
                    {u.name ?? <span className="text-[#bfbfbf]">—</span>}
                  </td>
                  <td className="border border-[#e8e8e8] px-3 py-2 text-[#595959]">
                    {u.phone ?? <span className="text-[#bfbfbf]">—</span>}
                  </td>
                  <td className="border border-[#e8e8e8] px-3 py-2 text-[#595959]">
                    {u.email ?? <span className="text-[#bfbfbf]">—</span>}
                  </td>
                  <td className="border border-[#e8e8e8] px-3 py-2 font-mono text-[#262626]">
                    {u.lineCount}
                  </td>
                  <td className="border border-[#e8e8e8] px-3 py-2 font-mono text-[#262626]">
                    {u.succeededCalls ?? u.lineCount}
                    {u.succeededCalls === 0 && u.lineCount > 0 ? (
                      <span className="ml-1 text-xs text-[#faad14]">未扣费</span>
                    ) : null}
                  </td>
                  <FinanceTokenUsageRowCells usage={u.tokenUsage} />
                  <td className="border border-[#e8e8e8] px-3 py-2 text-[#595959] tabular-nums">
                    {u.latestAt
                      ? new Date(u.latestAt).toLocaleString("sv-SE", {
                          timeZone: "Asia/Shanghai",
                          hour12: false,
                        })
                      : "—"}
                  </td>
                  <td className="border border-[#e8e8e8] px-3 py-2">
                    <Link
                      href={`/admin/billing/users/${u.id}`}
                      className="text-[#1890ff] hover:underline"
                    >
                      管理员视角 →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 text-xs text-[#8c8c8c]">
        管理员视角可见全部 34 列 / 7 组（Finance 2.0 · 含工具页面 / 状态 / 行来源）。
        用户视角为过滤后的列 / 3 组。
      </div>
    </FinancePageShell>
  );
}
