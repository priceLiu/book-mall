"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

import { ReferralShareDialog } from "@/components/account/referral-share-dialog";
import { Button } from "@/components/ui/button";

/** 概览 · 账户身份卡片右上角「分享得积分」入口。 */
export function AccountReferralShareEntry() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="sm"
        className="shrink-0 bg-violet-600 hover:bg-violet-700"
        onClick={() => setOpen(true)}
      >
        <Share2 className="mr-1.5 size-4" />
        分享得积分
      </Button>
      <ReferralShareDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
