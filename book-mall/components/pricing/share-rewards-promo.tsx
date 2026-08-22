import Link from "next/link";
import { Gift, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ShareRewardsPromo({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section className="mx-auto mb-10 max-w-4xl rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 to-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[#1f2328]">
            <Gift className="size-5 text-violet-600" />
            分享得积分
          </h2>
          <ul className="space-y-1.5 text-sm text-[#656d76]">
            <li>
              <strong className="text-[#1f2328]">邀请好友</strong>：好友通过你的链接注册，并在
              <strong> 首次订阅或充值 </strong>
              后，你获得 <strong>20 积分</strong>（每人一次）。
            </li>
            <li>
              <strong className="text-[#1f2328]">分享工作流</strong>：在画布 / 电商 / 快速复刻中分享模板，好友
              <strong> 首次成功生成并首笔付费 </strong>
              后，你获得 <strong>40 积分</strong>（每人一次）。
            </li>
            <li className="text-xs">同一好友按先到先得仅发一笔奖励；全部为积分，自动到账。</li>
          </ul>
        </div>
        {isLoggedIn ? (
          <Button asChild className="shrink-0 bg-violet-600 hover:bg-violet-700">
            <Link href="/account/referral">
              <Share2 className="mr-2 size-4" />
              去分享
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline" className="shrink-0">
            <Link href="/login?callbackUrl=%2Faccount%2Freferral">登录后分享</Link>
          </Button>
        )}
      </div>
    </section>
  );
}
