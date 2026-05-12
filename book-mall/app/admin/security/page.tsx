import { AdminSelfResetPasswordCard } from "@/components/admin/admin-self-reset-password";

export const metadata = {
  title: "账号安全 — 管理后台",
};

export default function AdminSecurityPage() {
  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold">账号安全</h1>
        <p className="text-sm text-muted-foreground mt-1">
          管理员登录密码重置后，请尽快使用新密码重新登录各端会话。
        </p>
      </div>
      <AdminSelfResetPasswordCard />
    </div>
  );
}
