import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { listShareCodePrefixes } from "@/lib/share/share-code-prefix-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "分享码前缀注册表 — 管理后台",
};

export default async function AdminShareCodePrefixesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/admin");

  const rows = await listShareCodePrefixes();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#1f2328]">分享码前缀注册表</h1>
        <p className="mt-1 text-sm text-[#656d76]">
          仅管理员可见：前缀与应用的映射。普通用户无法从码推断子站。
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#d0d7de] bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#d0d7de] bg-[#f6f8fa] text-xs text-[#656d76]">
              <th className="px-4 py-2 font-medium">前缀</th>
              <th className="px-4 py-2 font-medium">类型</th>
              <th className="px-4 py-2 font-medium">应用</th>
              <th className="px-4 py-2 font-medium">状态</th>
              <th className="px-4 py-2 font-medium">备注</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-[#eaeef2]">
                <td className="px-4 py-3 font-mono font-semibold tracking-wider">{row.prefix}</td>
                <td className="px-4 py-3">{row.kind === "REFERRAL" ? "邀请注册" : "工作流"}</td>
                <td className="px-4 py-3">{row.app ?? "—"}</td>
                <td className="px-4 py-3">
                  {row.enabled ? (
                    <span className="text-green-700">启用</span>
                  ) : (
                    <span className="text-amber-700">停用</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[#656d76]">{row.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
