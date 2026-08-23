"use client";

import Link from "next/link";
import { useState } from "react";
import { Share2 } from "lucide-react";

import { ReferralShareDialog } from "@/components/account/referral-share-dialog";
import { accountBodyTextLinkClass } from "@/components/account/account-nav-styles";
import { Button } from "@/components/ui/button";
import type { ReferralSharePersona } from "@/lib/referral/referral-share-persona";
import { cn } from "@/lib/utils";

/** 概览 · 账户身份卡片右上角分享入口 + 邀请明细链接。 */
export function AccountReferralShareEntry({
  sharePersona = "personal",
}: {
  sharePersona?: ReferralSharePersona;
}) {
  const [open, setOpen] = useState(false);
  const isTeamOwner = sharePersona === "team_owner";
  const actionLabel = isTeamOwner ? "分享邀请" : "分享得积分";

  return (
    <>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Button
          type="button"
          size="sm"
          className="shrink-0 bg-violet-600 hover:bg-violet-700"
          onClick={() => setOpen(true)}
        >
          <Share2 className="mr-1.5 size-4" />
          {actionLabel}
        </Button>
        <Link href="/account/referral" className={cn(accountBodyTextLinkClass(), "text-xs")}>
          邀请明细
        </Link>
      </div>
      <ReferralShareDialog
        open={open}
        onClose={() => setOpen(false)}
        sharePersona={sharePersona}
      />
    </>
  );
}
