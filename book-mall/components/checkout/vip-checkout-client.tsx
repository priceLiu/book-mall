"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";

import { WechatPersonalCheckout } from "@/components/pay/wechat-personal-checkout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  VIP_COMPLIANCE_FOOTER_ITEMS,
  VIP_COMPLIANCE_FOOTER_TITLE,
  VIP_CONTRACT_NOTE,
  VIP_CREDIT_VALIDITY_YEARS,
} from "@/components/pricing/vip-package-disclosure";
import {
  computeVipPackageQuote,
  computeVipSeatAllocation,
} from "@/lib/finance/vip-package-calculator";
import { canUseAdminInstantCheckout } from "@/lib/payments/session-auth-client";

export function VipCheckoutClient({
  amountYuan,
  scheme,
  seats: initialSeats,
  schemeLabel,
}: {
  amountYuan: number;
  scheme: "general_heavy" | "video_heavy";
  seats: number;
  schemeLabel: string;
}) {
  const { data: session } = useSession();
  const adminInstant = canUseAdminInstantCheckout(session?.user?.role);
  const [teamName, setTeamName] = useState("");

  const quote = useMemo(
    () => computeVipPackageQuote({ amountYuan, targetMargin: 0.5 }),
    [amountYuan],
  );
  const selected =
    scheme === "video_heavy" ? quote.schemeVideoHeavy : quote.schemeGeneralHeavy;
  const seatAlloc = useMemo(
    () =>
      computeVipSeatAllocation({
        totalGeneralCredits: selected.generalCredits,
        totalVideoCredits: selected.videoCredits,
        seats: initialSeats,
      }),
    [selected.generalCredits, selected.videoCredits, initialSeats],
  );

  const createPayload = {
    productKind: "VIP_PACKAGE" as const,
    amountYuan,
    scheme,
    seats: initialSeats,
    teamName: teamName.trim() || undefined,
  };

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>{adminInstant ? "VIP大额预充结账（管理员）" : "VIP大额预充结账"}</CardTitle>
        <CardDescription>
          {schemeLabel} · {initialSeats} 席 · ¥{amountYuan.toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm">
          <p className="font-medium text-foreground">
            本次到账积分（有效期 {VIP_CREDIT_VALIDITY_YEARS} 年，周期内无月度清零）
          </p>
          <p className="mt-1 text-muted-foreground">
            {selected.totalCredits.toLocaleString()} 总积分
            <span className="mx-1">·</span>
            {selected.generalCredits.toLocaleString()} 通用 +{" "}
            {selected.videoCredits.toLocaleString()} 视频
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            均分参考：{seatAlloc.perSeatGeneral.toLocaleString()} 通用 +{" "}
            {seatAlloc.perSeatVideo.toLocaleString()} 视频 / 席
          </p>
        </div>

        <p className="text-xs text-muted-foreground">{VIP_CONTRACT_NOTE}</p>

        <label className="block text-sm">
          团队名称（新建 VIP 团队时）
          <input
            className="mt-1 w-full rounded border px-2 py-1.5"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="我的 VIP 团队"
          />
        </label>

        <WechatPersonalCheckout
          createPayload={createPayload}
          adminInstant={adminInstant}
          successRedirect="/account/team?success=vip"
          onSuccessMessage="预充订单已提交，积分将在财务确认后发放至团队共享池。"
        />

        <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
          <p className="text-[11px] font-medium text-foreground">{VIP_COMPLIANCE_FOOTER_TITLE}</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[10px] leading-relaxed text-muted-foreground">
            {VIP_COMPLIANCE_FOOTER_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </div>

        <Button variant="outline" className="w-full" asChild>
          <Link href="/pricing#vip-package">返回定价页</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
