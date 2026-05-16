"use client";

import { useActionState } from "react";
import {
  billingActionIdle,
  extendActiveSubscription,
  type BillingActionState,
} from "@/app/actions/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FeedbackBanner } from "./feedback-banner";

export function ExtendSubscriptionForm() {
  const [state, action, pending] = useActionState<BillingActionState, FormData>(
    extendActiveSubscription,
    billingActionIdle,
  );

  return (
    <div className="space-y-3">
      <form action={action} className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label htmlFor="sub-email">用户邮箱</Label>
          <Input id="sub-email" name="email" type="email" required className="w-64" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sub-days">延长天数</Label>
          <Input
            id="sub-days"
            name="days"
            type="number"
            min={1}
            max={3650}
            required
            className="w-32"
            defaultValue={30}
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "续期中…" : "续期"}
        </Button>
      </form>
      <FeedbackBanner state={state} />
    </div>
  );
}
