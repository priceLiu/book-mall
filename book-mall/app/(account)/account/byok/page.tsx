import Link from "next/link";
import { KeyRound } from "lucide-react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getGatewayLinkStatusForUser } from "@/lib/canvas/book-gateway-link";
import { AccountSectionHeader } from "@/components/account/account-section-header";
import { accountBodyTextLinkClass } from "@/components/account/account-nav-styles";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "自带 Key（BYOK）— 个人中心",
};

export default async function AccountByokPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/byok");

  const gatewayStatus = await getGatewayLinkStatusForUser(session.user.id);
  const gatewayOrigin =
    process.env.NEXT_PUBLIC_GATEWAY_ORIGIN?.trim() || "http://localhost:3005";
  const textLink = accountBodyTextLinkClass();

  return (
    <>
      <AccountSectionHeader
        title="自带 Key（BYOK）"
        description="BYOK 套餐已退役。请开通会员订阅，并通过 Gateway 使用平台代付或绑定厂商 Key。"
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" aria-hidden />
            当前推荐路径
          </CardTitle>
          <CardDescription className="text-xs">
            模型费用经 Gateway 结算；平台侧使用会员订阅与轻量包积分
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              在{" "}
              <Link href="/account/gateway" className={textLink}>
                Gateway API Key
              </Link>{" "}
              页关联 <code className="text-xs">sk-gw</code>
              {gatewayStatus.linked ? (
                <span className="ml-2 text-emerald-600">（已完成）</span>
              ) : (
                <span className="ml-2 text-amber-600">（待完成）</span>
              )}
            </li>
            <li>
              打开{" "}
              <a
                href={gatewayOrigin}
                target="_blank"
                rel="noopener noreferrer"
                className={textLink}
              >
                Gateway 控制台
              </a>
              ，按需绑定厂商凭证或使用平台代付
            </li>
            <li>
              查看{" "}
              <Link href="/pricing" className={textLink}>
                会员与轻量包
              </Link>
              {" · "}
              <Link href="/account/billing" className={textLink}>
                积分余额
              </Link>
            </li>
          </ol>
        </CardContent>
      </Card>
    </>
  );
}
