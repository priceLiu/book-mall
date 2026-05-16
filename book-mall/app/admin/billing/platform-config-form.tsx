"use client";

import { useActionState } from "react";
import {
  billingActionIdle,
  updatePlatformBillingConfig,
  type BillingActionState,
} from "@/app/actions/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FeedbackBanner } from "./feedback-banner";

type Config = {
  minBalanceLinePoints: number;
  balanceWarnHighPoints: number;
  balanceWarnMidPoints: number;
  llmInputPer1kTokensPoints: number;
  llmOutputPer1kTokensPoints: number;
  toolInvokePerCallPoints: number;
  usageAnomalyRatioPercent: number;
};

export function PlatformConfigForm({ config }: { config: Config }) {
  const [state, action, pending] = useActionState<BillingActionState, FormData>(
    updatePlatformBillingConfig,
    billingActionIdle,
  );

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field
        label="最低余额线（点）"
        name="minBalanceLinePoints"
        defaultValue={config.minBalanceLinePoints}
      />
      <Field
        label="较高预警线（点）"
        name="balanceWarnHighPoints"
        defaultValue={config.balanceWarnHighPoints}
      />
      <Field
        label="中等预警线（点）"
        name="balanceWarnMidPoints"
        defaultValue={config.balanceWarnMidPoints}
      />
      <Field
        label="LLM 输入 / 千 token（点）"
        name="llmInputPer1kTokensPoints"
        defaultValue={config.llmInputPer1kTokensPoints}
      />
      <Field
        label="LLM 输出 / 千 token（点）"
        name="llmOutputPer1kTokensPoints"
        defaultValue={config.llmOutputPer1kTokensPoints}
      />
      <Field
        label="工具单次调用（点）"
        name="toolInvokePerCallPoints"
        defaultValue={config.toolInvokePerCallPoints}
      />
      <Field
        label="异常消耗倍数（%）"
        name="usageAnomalyRatioPercent"
        defaultValue={config.usageAnomalyRatioPercent}
      />
      <div className="sm:col-span-2 flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "保存中…" : "保存配置"}
        </Button>
        <div className="flex-1">
          <FeedbackBanner state={state} />
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: number;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input name={name} type="number" required min={0} defaultValue={defaultValue} />
    </div>
  );
}
