import { Suspense } from "react";
import { TeamMembersClient } from "@/components/team-members-client";
import { FinancePageState } from "@/components/finance-page-shell";

export const dynamic = "force-dynamic";

export default function TeamMembersPage() {
  return (
    <Suspense fallback={<FinancePageState>加载中…</FinancePageState>}>
      <TeamMembersClient />
    </Suspense>
  );
}
