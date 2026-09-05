import { AdminTemplatesClient } from "@/components/admin/template-admin/admin-templates-client";

export const metadata = {
  title: "模板管理 — 管理后台",
};

export default function AdminTemplatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">模板管理</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          统一维护平台预置模板：快速复制官方示例，以及电商工具箱模板区与模特库。
        </p>
      </div>
      <AdminTemplatesClient />
    </div>
  );
}
