import { ReferralPanelSkeleton } from "@/components/account/referral-panel-skeleton";

export default function ReferralLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <ReferralPanelSkeleton />
    </div>
  );
}
