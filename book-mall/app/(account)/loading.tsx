import { AccountOverviewSkeleton } from "@/components/account/account-overview-skeleton";
import { AccountSectionHeader } from "@/components/account/account-section-header";

/** 个人中心子路由切换 · 概览骨架（壳层 layout 已即时渲染）。 */
export default function AccountLoading() {
  return (
    <>
      <AccountSectionHeader
        title="概览"
        description="积分、计费身份与套餐状态一览；其它模块请用左侧菜单切换。"
      />
      <AccountOverviewSkeleton />
    </>
  );
}
