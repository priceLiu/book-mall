import { AdminSubNav } from "@/components/layout/admin-sub-nav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[calc(100dvh-var(--canvas-header-h))] min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-white/10 px-4 py-4 sm:px-6 md:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="canvas-sans text-xl font-semibold text-white">管理中心</h1>
          <AdminSubNav align="start" />
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
