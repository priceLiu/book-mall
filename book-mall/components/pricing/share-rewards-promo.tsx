"use client";

import Link from "next/link";
import { useState } from "react";
import { Gift, Share2 } from "lucide-react";

import { ShareGuideDialog } from "@/components/pricing/share-guide-dialog";
import { Button } from "@/components/ui/button";

export function ShareRewardsPromo({
  isLoggedIn,
  welcomeGiftCredits,
}: {
  isLoggedIn: boolean;
  welcomeGiftCredits?: number | null;
}) {
  const [guideOpen, setGuideOpen] = useState(false);
  const showWelcome =
    welcomeGiftCredits != null && welcomeGiftCredits > 0;

  return (
    <>
      <section className="site-pricing-share-promo">
        <Gift className="site-pricing-share-promo-icon" aria-hidden />
        <p className="site-pricing-share-promo-text">
          {showWelcome ? (
            <>
              <strong>新用户</strong>：注册即送{" "}
              {welcomeGiftCredits.toLocaleString()} 积分（30 天内有效）。
            </>
          ) : null}
          {showWelcome ? " " : null}
          <strong>分享得积分</strong>：邀请好友首订/充值 +20；分享模板好友首付 +40。每人一次，自动到账。
        </p>
        <div className="site-pricing-share-promo-actions">
          {isLoggedIn ? (
            <Button asChild size="sm" className="h-8 bg-violet-600 px-3 text-xs hover:bg-violet-700">
              <Link href="/account/referral">
                <Share2 className="mr-1.5 size-3.5" />
                去分享
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm" variant="outline" className="h-8 px-3 text-xs">
              <Link href="/login?callbackUrl=%2Faccount%2Freferral">登录后分享</Link>
            </Button>
          )}
          <button
            type="button"
            className="site-pricing-share-promo-link"
            onClick={() => setGuideOpen(true)}
          >
            详细说明
          </button>
        </div>
      </section>
      {guideOpen ? <ShareGuideDialog onClose={() => setGuideOpen(false)} /> : null}
    </>
  );
}
