import { prisma } from "@/lib/prisma";
import { maskPhone } from "@/lib/auth/phone";
import { formatAdminDateTime } from "@/lib/finance/billing-datetime";
import { AdminUserResetPasswordButton } from "@/components/admin/admin-user-reset-password-button";
import { AdminUserBindPhoneButton } from "@/components/admin/admin-user-bind-phone-button";

function accountScopeLabel(inTeam: boolean): string {
  return inTeam ? "团队" : "个人";
}

function billingPersonaLabel(persona: "PLATFORM_CREDIT" | "BYOK"): string {
  return persona === "BYOK" ? "自带 Key" : "平台代付";
}

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      email: true,
      phone: true,
      phoneVerifiedAt: true,
      name: true,
      role: true,
      billingPersona: true,
      createdAt: true,
    },
  });

  const userIds = users.map((u) => u.id);
  const teamMembers =
    userIds.length > 0
      ? await prisma.tenantMember.findMany({
          where: {
            userId: { in: userIds },
            status: "ACTIVE",
            tenant: { type: "TEAM" },
          },
          select: { userId: true },
        })
      : [];
  const teamUserIds = new Set(teamMembers.map((m) => m.userId));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">用户</h1>
        <p className="text-sm text-muted-foreground">
          最近 200 条注册记录 · 老邮箱用户可在「补录手机」绑定手机号后用手机号登录
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-secondary">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="border-b border-secondary bg-muted/50">
            <tr>
              <th className="p-3 font-medium">邮箱</th>
              <th className="p-3 font-medium">手机号</th>
              <th className="p-3 font-medium">昵称</th>
              <th className="p-3 font-medium">空间</th>
              <th className="p-3 font-medium">计费身份</th>
              <th className="p-3 font-medium">角色</th>
              <th className="p-3 font-medium">注册时间</th>
              <th className="p-3 font-medium w-[12rem]">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-secondary/80 last:border-0">
                <td className="p-3 tabular-nums text-muted-foreground">
                  {u.email ?? "—"}
                </td>
                <td className="p-3 tabular-nums">
                  {u.phoneVerifiedAt && u.phone ? (
                    maskPhone(u.phone)
                  ) : u.phone ? (
                    <span className="text-amber-600 dark:text-amber-400">
                      {maskPhone(u.phone)}（未验证）
                    </span>
                  ) : (
                    <span className="text-muted-foreground">未绑定</span>
                  )}
                </td>
                <td className="p-3">{u.name ?? "—"}</td>
                <td className="p-3">
                  <span
                    className={
                      teamUserIds.has(u.id)
                        ? "rounded-md border border-border bg-muted px-2 py-0.5 text-foreground"
                        : "rounded-md bg-muted px-2 py-0.5 text-muted-foreground"
                    }
                  >
                    {accountScopeLabel(teamUserIds.has(u.id))}
                  </span>
                </td>
                <td className="p-3">
                  <span
                    className={
                      u.billingPersona === "BYOK"
                        ? "rounded-md border border-border bg-muted px-2 py-0.5 text-foreground"
                        : "rounded-md bg-muted px-2 py-0.5 text-muted-foreground"
                    }
                  >
                    {billingPersonaLabel(u.billingPersona)}
                  </span>
                </td>
                <td className="p-3">
                  <span
                    className={
                      u.role === "ADMIN"
                        ? "rounded-md border border-border bg-muted px-2 py-0.5 text-foreground"
                        : ""
                    }
                  >
                    {u.role}
                  </span>
                </td>
                <td className="p-3 text-muted-foreground tabular-nums">
                  {formatAdminDateTime(u.createdAt)}
                </td>
                <td className="p-3 align-top space-y-2">
                  <AdminUserBindPhoneButton
                    userId={u.id}
                    email={u.email}
                    phone={u.phone}
                    phoneVerified={Boolean(u.phoneVerifiedAt)}
                  />
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
