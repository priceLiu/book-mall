"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { AdminEcomTemplatesPanel } from "@/components/admin/template-admin/admin-ecom-templates-panel";
import { AdminQrTemplatesPanel } from "@/components/admin/template-admin/admin-qr-templates-panel";

export type AdminTemplatesTab = "quick-replica" | "ecom";

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm font-medium ${
        active
          ? "bg-[#0969da] text-white"
          : "border border-[#d0d7de] bg-white text-[#1f2328] hover:bg-[#f6f8fa]"
      }`}
    >
      {label}
    </button>
  );
}

function AdminTemplatesInner() {
  const router = useRouter();
  const search = useSearchParams();
  const tab: AdminTemplatesTab =
    search.get("tab") === "ecom" ? "ecom" : "quick-replica";

  function setTab(next: AdminTemplatesTab) {
    const params = new URLSearchParams(search.toString());
    params.set("tab", next);
    if (next !== "ecom") params.delete("ecom");
    router.replace(`/admin/templates?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <TabButton
          active={tab === "quick-replica"}
          label="快速复制"
          onClick={() => setTab("quick-replica")}
        />
        <TabButton
          active={tab === "ecom"}
          label="电商工具箱"
          onClick={() => setTab("ecom")}
        />
      </div>
      {tab === "quick-replica" ? <AdminQrTemplatesPanel /> : <AdminEcomTemplatesPanel />}
    </div>
  );
}

export function AdminTemplatesClient() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">加载中…</p>}>
      <AdminTemplatesInner />
    </Suspense>
  );
}
