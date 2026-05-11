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

export function AccountDevActions() {
  const router = useRouter();

  function push(path: string) {
    router.push(path);
  }

  return (
    <Card className="border-dashed border-amber-500/50 bg-amber-500/5">
      <CardHeader>
        <CardTitle>开发：模拟收银入口</CardTitle>
        <CardDescription>
          与正式入口一致：跳转占位收银页后点「支付成功」落库。开发环境默认可用；Staging 需配置
          ALLOW_MOCK_PAYMENT=true（切勿用于真实生产）。详见仓库{" "}
          <code className="text-xs bg-muted px-1 rounded">doc/process/mock-payment-checkout.md</code>
          。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => push("/pay/mock-topup")}>
          模拟充值页
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => push("/pay/mock-subscribe?plan=monthly")}
        >
          模拟订阅（月度）
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => push("/pay/mock-subscribe?plan=yearly")}
        >
          模拟订阅（年度）
        </Button>
      </CardContent>
    </Card>
  );
}
