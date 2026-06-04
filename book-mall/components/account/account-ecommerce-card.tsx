import { ShoppingBag } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LaunchEcommerceAppButton } from "@/components/account/launch-ecommerce-app";
import { EcomBillingModeForm } from "@/components/account/ecom-billing-mode-form";
import type { EcomBillingMode } from "@prisma/client";

export function AccountEcommerceCard({
  canLaunch,
  originConfigured,
  ecomBillingMode,
}: {
  canLaunch: boolean;
  originConfigured: boolean;
  ecomBillingMode: EcomBillingMode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-muted-foreground" aria-hidden />
          <CardTitle className="text-base">电商工具箱</CardTitle>
        </div>
        <CardDescription className="text-xs leading-relaxed">
          主图、详情、带货视频与品牌 VI。支持「代付按次」或「月费 + 自备 Gateway Key」两种计费。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <EcomBillingModeForm initialMode={ecomBillingMode} />
        <LaunchEcommerceAppButton
          enabled={canLaunch && originConfigured}
          helperText={
            !originConfigured
              ? "未配置 NEXT_PUBLIC_ECOMMERCE_WEB_ORIGIN"
              : !canLaunch
                ? "须开通电商工具箱月费，或切换为代付按次模式"
                : undefined
          }
        />
      </CardContent>
    </Card>
  );
}
