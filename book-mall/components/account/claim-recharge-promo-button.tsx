"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { claimRechargePromoTemplateAction } from "@/app/actions/recharge-promo";
import { Button } from "@/components/ui/button";

export function ClaimRechargePromoButton({
  templateId,
  disabled,
}: {
  templateId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="sm"
        variant="subscription"
        disabled={disabled || busy}
        className="w-full sm:w-auto"
        onClick={() => {
          setErr(null);
          setBusy(true);
          void (async () => {
            try {
              await claimRechargePromoTemplateAction(templateId);
              router.refresh();
            } catch (e) {
              setErr(e instanceof Error ? e.message : "领取失败");
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        {busy ? "领取中…" : "领取优惠券"}
      </Button>
      {err ? <p className="text-xs text-destructive">{err}</p> : null}
    </div>
  );
}
