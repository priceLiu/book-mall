"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Film, Zap, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CREDIT_TOPUP_PACKS,
  VIDEO_CREDIT_TOPUP_PACKS,
  packListPriceYuan,
  type CreditTopupPack,
} from "@/lib/billing/credit-topup-packs";

const PANEL_CLASS =
  "rounded-3xl border border-sky-200/70 bg-white/70 dark:border-slate-700/60 dark:bg-slate-900/50";

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
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
      {packs.map((pack) => {
        const listYuan = packListPriceYuan(pack.credits, anchorYuan);
        return (
          <div
            key={pack.id}
            className={cn(PANEL_CLASS, "flex flex-col p-6")}
            style={{ backdropFilter: "blur(10px)" }}
          >
            <div className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
              {pack.label}
            </div>
            <div className="mt-2 text-3xl font-light text-foreground">
              {pack.credits.toLocaleString()}
              <span className="ml-1 text-base text-muted-foreground">积分</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-foreground">¥{pack.priceYuan}</span>
              {listYuan > pack.priceYuan ? (
                <span className="text-sm text-muted-foreground line-through">¥{listYuan}</span>
              ) : null}
              {pack.promo ? (
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  {pack.promo}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              约 ¥{(pack.priceYuan / pack.credits).toFixed(3)}/积分
              {pack.pool === "VIDEO" ? " · 视频专项池" : " · 通用池"}
            </p>
            <Button
              type="button"
              className={cn(
                "mt-5 w-full text-white",
                pack.pool === "VIDEO"
                  ? "bg-violet-600 hover:bg-violet-700"
                  : "bg-sky-600 hover:bg-sky-700",
              )}
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
}: {
  anchorYuan: number;
  isTeam: boolean;
  teamTenants: { id: string; name: string }[];
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const activeTeam = teamTenants[0] ?? null;

  async function buyPack(pack: CreditTopupPack) {
    if (!isLoggedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent("/pricing")}`);
      return;
    }
    setLoadingId(pack.id);
    setMessage(null);
    try {
      const res = await fetch("/api/dev/mock-credit-topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packId: pack.id,
          target: isTeam && activeTeam ? "team" : "personal",
          tenantId: isTeam && activeTeam ? activeTeam.id : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "充值失败");
      const poolLabel = pack.pool === "VIDEO" ? "视频池" : "通用池";
      setMessage(
        `已到账 ${pack.credits.toLocaleString()} 积分（${poolLabel}），当前余额 ${Number(data.balanceAfter).toLocaleString()} 积分。`,
      );
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "充值失败");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <>
      <section className="mt-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <Zap className="h-5 w-5 text-amber-500" />
              积分加油包（加量包）
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              套餐积分用完可即时加购，到账后立即可用。
              {isTeam && activeTeam
                ? ` 充入「${activeTeam.name}」团队共享池（仅主账号）。`
                : isTeam
                  ? " 开通团队后，可在此为团队共享池加购。"
                  : " 充入个人通用积分池。"}
            </p>
          </div>
          {isTeam ? (
            <Link
              href="/account/team"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 underline underline-offset-4 hover:text-amber-500 dark:text-amber-400"
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

      <section className="mt-12">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <Film className="h-5 w-5 text-violet-500" />
            视频专项充值包
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            独立视频积分池，不占用套餐月积分；适合高频视频生成用户加购。
          </p>
        </div>

        <PackGrid
          packs={VIDEO_CREDIT_TOPUP_PACKS}
          anchorYuan={anchorYuan}
          loadingId={loadingId}
          onBuy={buyPack}
        />
      </section>

      {message ? (
        <p className="mt-4 text-center text-sm text-foreground">{message}</p>
      ) : null}

      <p className="mt-4 text-center text-xs text-muted-foreground">
        开发环境为模拟到账；正式支付接入后同档位价格不变。
        {!isLoggedIn ? (
          <>
            {" "}
            <Link href="/login?callbackUrl=/pricing" className="text-amber-600 underline dark:text-amber-400">
              登录后购买
            </Link>
          </>
        ) : null}
      </p>
    </>
  );
}
