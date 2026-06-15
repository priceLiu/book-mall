"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** 开发快捷入口：走正式 Checkout 流程（管理员可一键确认）。 */
export function AccountDevActions() {
  const router = useRouter();

  function push(path: string) {
    router.push(path);
  }

  return (
    <Card className="border-dashed border-amber-500/50 bg-amber-500/5">
      <CardHeader>
        <CardTitle>开发：收银快捷入口</CardTitle>
        <CardDescription>
          与正式用户相同：微信个人码 + 备注码；平台员工自购可走管理员一键确认。详见{" "}
          <code className="rounded bg-muted px-1 text-xs">docs/releases/2026-06-wechat-pay-platform-models.md</code>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button type="button" variant="subscription" size="sm" onClick={() => push("/checkout/topup?packId=pack-light")}>
          轻量包收银
        </Button>
        <Button type="button" variant="subscription" size="sm" onClick={() => push("/pricing")}>
          会员 / BYOK 定价
        </Button>
        <Button type="button" variant="subscription" size="sm" onClick={() => push("/admin/payments")}>
          支付核对后台
        </Button>
      </CardContent>
    </Card>
  );
}
