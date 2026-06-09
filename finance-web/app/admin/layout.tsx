import { AdminSidebar } from "@/components/admin-sidebar";
import { FinanceAppTopBar } from "@/components/finance-app-top-bar";
import { FinanceViewerBar } from "@/components/finance-viewer-bar";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f0f2f5]">
        <FinanceAppTopBar scope="admin" />
        <FinanceViewerBar scope="admin" />
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
