import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "欢迎" };
export const dynamic = "force-dynamic";

export default async function OnboardingWelcomePage({
  searchParams,
}: {
  searchParams?: { persona?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { billingPersona: true, billingPersonaLockedAt: true },
  });

  if (!user?.billingPersonaLockedAt) {
    redirect("/onboarding/billing-persona");
  }

  const persona =
    searchParams?.persona === "BYOK" || user.billingPersona === "BYOK"
      ? "BYOK"
      : "PLATFORM_CREDIT";

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>{persona === "BYOK" ? "欢迎使用 BYOK 模式" : "欢迎使用平台代付"}</CardTitle>
          <CardDescription>
            {persona === "BYOK"
              ? "按以下步骤完成 Gateway 绑定后即可使用 AI 工具。"
              : "购买会员套餐后即可使用 AI 工具，费用从积分池实时扣除。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {persona === "BYOK" ? (
            <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
              <li>
                <Link href="/pricing#personal" className="text-primary underline">
                  开通 BYOK 月费套餐
                </Link>
              </li>
              <li>
                <Link href="/account/gateway" className="text-primary underline">
                  绑定 Gateway 并添加厂商 Key
                </Link>
              </li>
              <li>返回工具站开始创作</li>
            </ol>
          ) : (
            <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
              <li>
                <Link href="/pricing" className="text-primary underline">
                  选择并购买会员套餐
                </Link>
              </li>
              <li>积分不足时在轻量包页面充值</li>
              <li>打开 AI 工具站开始创作（无需绑定 Gateway Key）</li>
            </ol>
          )}
          <Button asChild className="w-full">
            <Link href={persona === "BYOK" ? "/account/byok" : "/pricing"}>
              {persona === "BYOK" ? "前往 BYOK 中心" : "查看会员套餐"}
            </Link>
          </Button>
          <Button variant="outline" asChild className="w-full">
            <Link href="/account">进入个人中心</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
