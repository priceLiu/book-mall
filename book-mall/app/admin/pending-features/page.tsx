import { AdminPendingFeaturesClient } from "@/components/admin/admin-pending-features-client";

export const metadata = {
  title: "待做功能 — 管理后台",
};

export default function AdminPendingFeaturesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">待做功能</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          <strong className="font-medium text-foreground">待做功能</strong>：产品路线图核心能力；
          <strong className="font-medium text-foreground">待处理</strong>：从{" "}
          <code className="text-xs">docs/</code> 导入的方案文档（功能名 = 文件名不含 .md）。
          支持编辑、预览文档与标记完成。
        </p>
      </div>
      <AdminPendingFeaturesClient />
    </div>
  );
}
