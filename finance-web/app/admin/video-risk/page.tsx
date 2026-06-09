import { FinanceAdminGate } from "@/components/finance-admin-gate";
import { VideoRiskClient } from "@/components/admin/video-risk-client";

export default function VideoRiskPage() {
  return (
    <FinanceAdminGate require="viewCost">
      <VideoRiskClient />
    </FinanceAdminGate>
  );
}
