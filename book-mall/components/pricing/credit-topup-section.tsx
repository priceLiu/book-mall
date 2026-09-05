"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CREDIT_TOPUP_PACKS,
  ADMIN_VIDEO_TOPUP_PACK,
  packListPriceYuan,
  type CreditTopupPack,
} from "@/lib/billing/credit-topup-packs";
import { AdminTopupVerifyDialog } from "@/components/pricing/admin-topup-verify-dialog";

const PANEL_CLASS =
  "rounded-2xl border border-border bg-card";

function PackGrid({
  packs,
  anchorYuan,
  loadingId,
  onBuy,
}: {
  packs: CreditTopupPack[];
  anchorYuan: number;
  loadingId: string | null;
  onBuy: (pack: CreditTopupPack) => void;
}) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-stretch">
      {packs.map((pack) => {
        const listYuan = packListPriceYuan(pack.credits, anchorYuan);
        return (
          <div
            key={pack.id}
            className={cn(PANEL_CLASS, "flex h-full min-h-0 flex-col p-6")}
          >
            <div className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
              {pack.label}
            </div>
            <div className="mt-2 text-3xl font-light text-foreground">
              {pack.credits.toLocaleString()}
              <span className="ml-1 text-base text-muted-foreground">积分</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-foreground">¥{pack.priceYuan.toFixed(2)}</span>
              {listYuan > pack.priceYuan ? (
                <span className="text-sm text-muted-foreground line-through">¥{listYuan}</span>
              ) : null}
              {pack.promo ? (
                <span className="text-xs font-semibold text-muted-foreground">
                  {pack.promo}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              约 ¥{(pack.priceYuan / pack.credits).toFixed(3)}/积分
            </p>
            <p className="mt-1 min-h-[2.5rem] text-xs text-muted-foreground">
              {pack.id === "pack-light"
                ? "轻量积分包，积分永不过期，可叠加月付"
                : "\u00a0"}
            </p>
            <Button
              type="button"
              className="mt-auto w-full"
              disabled={loadingId === pack.id}
              onClick={() => onBuy(pack)}
            >
              {loadingId === pack.id ? "处理中…" : "立即加购"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

export function CreditTopupSection({
  anchorYuan,
  isTeam,
  teamTenants,
  isLoggedIn,
  showAdminPacks = false,
  userPhone,
  returnTo,
}: {
  anchorYuan: number;
  isTeam: boolean;
  teamTenants: { id: string; name: string }[];
  isLoggedIn: boolean;
  showAdminPacks?: boolean;
  userPhone?: string | null;
  returnTo?: string | null;
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [adminVerifyPack, setAdminVerifyPack] = useState<CreditTopupPack | null>(null);

  const activeTeam = teamTenants[0] ?? null;

  async function buyPack(pack: CreditTopupPack) {
    if (!isLoggedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent("/pricing")}`);
      return;
    }
    if (pack.adminOnly && pack.requirePhoneVerify) {
      setAdminVerifyPack(pack);
      return;
    }
    const params = new URLSearchParams({ packId: pack.id });
    if (isTeam && activeTeam) {
      params.set("target", "team");
      params.set("tenantId", activeTeam.id);
    }
    const safeReturnTo = returnTo?.trim();
    if (safeReturnTo) params.set("returnTo", safeReturnTo);
    router.push(`/checkout/topup?${params.toString()}`);
  }

  return (
    <>
      <section className="mt-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="site-pricing-section-title">轻量包购买</h2>
            <p className="site-pricing-section-hint">轻量包积分，长期有效</p>
            <p className="site-pricing-section-hint">
              套餐积分用完可即时加购，到账后立即可用；可叠加月付会员。
              {isTeam && activeTeam
                ? ` 充入「${activeTeam.name}」团队共享池（仅主账号）。`
                : isTeam
                  ? " 开通团队后，可在此为团队共享池加购。"
                  : " 充入个人账户积分余额。"}
            </p>
          </div>
          {isTeam ? (
            <Link
              href="/account/team"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground"
            >
              <Users className="h-4 w-4" />
              团队管理入口
            </Link>
          ) : null}
        </div>

        <PackGrid
          packs={CREDIT_TOPUP_PACKS}
          anchorYuan={anchorYuan}
          loadingId={loadingId}
          onBuy={buyPack}
        />
      </section>

      {showAdminPacks ? (
        <section className="mt-12">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              管理员专用充值
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              仅平台管理员可见。购买前须验证注册手机号；支付 ¥0.01 后充入个人账户。
            </p>
          </div>
          <PackGrid
            packs={[ADMIN_VIDEO_TOPUP_PACK]}
            anchorYuan={anchorYuan}
            loadingId={loadingId}
            onBuy={buyPack}
          />
        </section>
      ) : null}

      {adminVerifyPack ? (
        <AdminTopupVerifyDialog
          pack={adminVerifyPack}
          defaultPhone={userPhone}
          onClose={() => setAdminVerifyPack(null)}
        />
      ) : null}

      {message ? (
        <p className="mt-4 text-sm text-muted-foreground" role="status">{message}</p>
      ) : null}
    </>
  );
}
