import { FeesSidebar } from "@/components/fees-sidebar";
import { FinanceAppTopBar } from "@/components/finance-app-top-bar";

export default function FeesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <FeesSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f0f2f5]">
        <FinanceAppTopBar scope="fees" />
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
