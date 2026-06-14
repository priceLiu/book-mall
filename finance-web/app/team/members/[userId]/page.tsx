import { Suspense } from "react";
import { TeamMemberDetailClient } from "@/components/team-member-detail-client";
import { FinancePageState } from "@/components/finance-page-shell";

export const dynamic = "force-dynamic";

export default function TeamMemberDetailPage({ params }: { params: { userId: string } }) {
  return (
    <Suspense fallback={<FinancePageState>加载中…</FinancePageState>}>
      <TeamMemberDetailClient userId={params.userId} />
    </Suspense>
  );
}
