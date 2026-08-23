import { AccountOverviewSkeleton } from "@/components/account/account-overview-skeleton";

/** 个人中心子路由切换 · 概览骨架（壳层 layout 已即时渲染）。 */
export default function AccountLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <AccountOverviewSkeleton />
    </div>
  );
}
