import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GatewayApiKeyForm } from "@/components/account/gateway-api-key-form";
import { AccountSectionHeader } from "@/components/account/account-section-header";

export const metadata = {
  title: "Gateway — 个人中心",
};

export default async function AccountGatewayPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  return (
    <>
      <AccountSectionHeader
        title="Gateway API Key"
        description="Canvas / Story / 工具站 / 电商工具箱经 Gateway 调用厂商；须先绑定凭证并关联 sk-gw。"
      />
      <Card id="gateway-api-key">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">关联 Gateway Key</CardTitle>
          <CardDescription className="text-xs leading-relaxed">
            在 Gateway 控制台绑定百炼、DeepSeek 等厂商凭证后，将生成的 sk-gw 关联到本书账号。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GatewayApiKeyForm />
        </CardContent>
      </Card>
    </>
  );
}
