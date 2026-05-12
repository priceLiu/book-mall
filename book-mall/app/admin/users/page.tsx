import { prisma } from "@/lib/prisma";
import { AdminUserResetPasswordButton } from "@/components/admin/admin-user-reset-password-button";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">用户</h1>
        <p className="text-sm text-muted-foreground">
          最近 200 条注册记录 · 管理员请在{" "}
          <code className="rounded bg-muted px-1 text-xs">ADMIN_EMAILS</code>{" "}
          中配置邮箱后执行{" "}
          <code className="rounded bg-muted px-1 text-xs">pnpm db:seed</code>
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-secondary">
        <table className="w-full min-w-[780px] text-left text-sm">
          <thead className="border-b border-secondary bg-muted/50">
            <tr>
              <th className="p-3 font-medium">邮箱</th>
              <th className="p-3 font-medium">昵称</th>
              <th className="p-3 font-medium">角色</th>
              <th className="p-3 font-medium">注册时间</th>
              <th className="p-3 font-medium w-[10rem]">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-secondary/80 last:border-0">
                <td className="p-3 tabular-nums text-muted-foreground">{u.email}</td>
                <td className="p-3">{u.name ?? "—"}</td>
                <td className="p-3">
                  <span
                    className={
                      u.role === "ADMIN"
                        ? "rounded-md bg-primary/15 px-2 py-0.5 text-primary"
                        : ""
                    }
                  >
                    {u.role}
                  </span>
                </td>
                <td className="p-3 text-muted-foreground">
                  {u.createdAt.toLocaleString("zh-CN")}
                </td>
                <td className="p-3 align-top">
                  <AdminUserResetPasswordButton userId={u.id} email={u.email} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
