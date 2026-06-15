import Link from "next/link";
import { CheckCircle2, KeyRound, AlertTriangle } from "lucide-react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGatewayLinkStatusForUser } from "@/lib/canvas/book-gateway-link";
import {
  getActiveByokSubscription,
  resolveByokSeatsForTenant,
} from "@/lib/billing/byok-subscription-service";
import { BYOK_TASK_KIND_LABEL } from "@/lib/billing/byok-pricing";
import { AccountSectionHeader } from "@/components/account/account-section-header";
import {
  accountBodyTextLinkClass,
} from "@/components/account/account-nav-styles";
import { getFinanceFeesRedirectUrl } from "@/lib/finance-account-redirect";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ByokRenewButton } from "@/components/account/byok-renew-button";

export const metadata = {
  title: "自带 Key（BYOK）— 个人中心",
};

function periodKeyOf(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function AccountByokPage({
  searchParams,
}: {
  searchParams?: { success?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/byok");

  const userId = session.user.id;
  const periodKey = periodKeyOf();

  const [personalSub, gatewayStatus, teamMemberships] = await Promise.all([
    getActiveByokSubscription({ ownerType: "USER", ownerId: userId }),
    getGatewayLinkStatusForUser(userId),
    prisma.tenantMember.findMany({
      where: {
        userId,
        status: "ACTIVE",
        role: "OWNER",
        tenant: { type: "TEAM", status: "ACTIVE" },
      },
      include: { tenant: { select: { id: true, name: true } } },
    }),
  ]);

  const teamSubs = await Promise.all(
    teamMemberships.map(async (m) => ({
      tenant: m.tenant,
      sub: await getActiveByokSubscription({
        ownerType: "TENANT",
        ownerId: m.tenant.id,
      }),
      seats: await resolveByokSeatsForTenant(m.tenant.id),
    })),
  );

  const quotas = personalSub
    ? await prisma.byokTaskQuota.findMany({
        where: { scopeKey: personalSub.scopeKey, active: true },
        orderBy: { taskKind: "asc" },
      })
    : [];

  const usageRows = personalSub
    ? await prisma.byokUsageMonthly.findMany({
        where: {
          ownerType: "USER",
          ownerId: userId,
          periodKey,
          scopeKey: personalSub.scopeKey,
        },
      })
    : [];

  const usageByKind = new Map(usageRows.map((r) => [r.taskKind, r]));

  const showSuccess = searchParams?.success === "1";
  const financeByokUrl = getFinanceFeesRedirectUrl("/fees/billing/byok");
  const gatewayOrigin =
    process.env.NEXT_PUBLIC_GATEWAY_ORIGIN?.trim() || "http://localhost:3005";
  const textLink = accountBodyTextLinkClass();

  return (
    <>
      {showSuccess ? (
        <div
          role="status"
          className="mb-6 flex gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-4 py-3 text-sm"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
          <p className="text-muted-foreground">
            BYOK 套餐已开通。请完成下方「绑定 Gateway」与「添加厂商 Key」后即可生成。
          </p>
        </div>
      ) : null}

      <AccountSectionHeader
        title="自带 Key（BYOK）"
        description="模型费用与厂商直接结算；平台收取技术服务费，套餐内含月度任务额度，超额从轻量包扣分。"
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">个人 BYOK</CardTitle>
            <CardDescription className="text-xs">
              绑定在你个人账号下的厂商 API Key
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {personalSub ? (
              <>
                <p>
                  状态：<span className="font-medium text-emerald-600">有效</span>
                </p>
                <p className="tabular-nums text-muted-foreground">
                  有效期至 {personalSub.periodEnd.toLocaleString("zh-CN")}
                  {" · "}
                  ¥{Number(personalSub.techServiceFeeYuan)}/月
                </p>
                {quotas.length > 0 ? (
                  <ul className="space-y-1 rounded-md bg-muted/40 px-3 py-2 text-xs">
                    {quotas.map((q) => {
                      const used = usageByKind.get(q.taskKind);
                      const includedUsed = used?.includedUsed ?? 0;
                      const overageUsed = used?.overageUsed ?? 0;
                      return (
                        <li key={q.taskKind}>
                          {BYOK_TASK_KIND_LABEL[q.taskKind] ?? q.label}：套餐内{" "}
                          {includedUsed}/{q.monthlyIncluded} 次
                          {overageUsed > 0 ? ` · 超额 ${overageUsed} 次` : ""}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  每次成功生成扣 1 次套餐内额度；超额从轻量包扣分。完整明细见{" "}
                  {financeByokUrl ? (
                    <a
                      href={financeByokUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={textLink}
                    >
                      BYOK 任务用量
                    </a>
                  ) : (
                    <Link href="/account/fees/byok" className={textLink}>
                      BYOK 任务用量
                    </Link>
                  )}
                  。
                </p>
                <ByokRenewButton scopeKey={personalSub.scopeKey} target="personal" />
              </>
            ) : (
              <>
                <p className="text-muted-foreground">未开通个人 BYOK 套餐。</p>
                <Button asChild size="sm" variant="subscription">
                  <Link href="/pricing">前往报价页开通</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">团队 BYOK</CardTitle>
            <CardDescription className="text-xs">
              由团队主账号开通，成员在团队空间下使用团队厂商 Key
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-xs leading-relaxed text-muted-foreground">
              团队 BYOK 与个人 BYOK <b className="font-medium text-foreground">并列</b>，不是「补差价升级」。
              须先{" "}
              <Link href="/account/team" className={textLink}>
                创建团队
              </Link>
              ，由主账号为团队单独开通（¥49/席/月，3 席起）；个人 ¥69/月 套餐可继续保留至到期。
            </p>
            {teamSubs.length === 0 ? (
              <p className="text-muted-foreground">
                你尚未创建团队。{" "}
                <Link href="/account/team" className={textLink}>
                  团队管理
                </Link>
              </p>
            ) : (
              teamSubs.map(({ tenant, sub, seats }) => (
                <div key={tenant.id} className="rounded-md border px-3 py-2">
                  <p className="font-medium">{tenant.name}</p>
                  {sub ? (
                    <>
                      <p className="mt-1 text-xs text-emerald-600">有效 · {seats} 席</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        至 {sub.periodEnd.toLocaleDateString("zh-CN")}
                      </p>
                      <div className="mt-2">
                        <ByokRenewButton
                          scopeKey={sub.scopeKey}
                          target="team"
                          tenantId={tenant.id}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="mt-1 text-xs text-muted-foreground">未开通</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <Link
                          href={`/checkout/byok?scope=team-seat&tenantId=${tenant.id}`}
                          className={textLink}
                        >
                          为团队开通 BYOK
                        </Link>
                      </p>
                    </>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" aria-hidden />
            开通后必做（3 步）
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
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
              ，添加百炼 / DeepSeek / KIE 等厂商凭证
            </li>
            <li>在工具站 / 画布生成时走你的厂商 Key；套餐内额度用完后从轻量包扣分</li>
          </ol>
          {!gatewayStatus.linked ? (
            <div className="flex gap-2 rounded-md border border-amber-300/50 bg-amber-500/5 px-3 py-2 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              <span>尚未关联 Gateway Key，生成请求将无法发起。</span>
            </div>
          ) : null}
          <p className="pt-1 text-xs text-muted-foreground">
            <Link href="/account/billing" className={textLink}>
              购买轻量包（超额用）
            </Link>
            <span className="mx-1.5 text-border">·</span>
            <Link href="/pricing" className={textLink}>
              查看 BYOK 价目
            </Link>
          </p>
        </CardContent>
      </Card>
    </>
  );
}
