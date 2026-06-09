"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  scopeKey: string;
  label: string;
  techServiceFeeYuan: number;
  minSeats: number | null;
  isLoggedIn: boolean;
  isTeamScope: boolean;
  teamTenants: { id: string; name: string }[];
};

export function ByokSubscribeButtons({
  scopeKey,
  label,
  techServiceFeeYuan,
  minSeats,
  isLoggedIn,
  isTeamScope,
  teamTenants,
}: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState(teamTenants[0]?.id ?? "");

  async function subscribe() {
    if (!isLoggedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent("/pricing")}`);
      return;
    }
    if (isTeamScope && !tenantId) {
      setMessage("请先创建团队，或从下拉选择要开通的团队");
      return;
    }
    router.push(
      `/checkout/byok?scope=${encodeURIComponent(scopeKey)}${isTeamScope && tenantId ? `&tenantId=${tenantId}` : ""}`,
    );
  }

  const priceHint = isTeamScope
    ? `¥${techServiceFeeYuan}/席/月${minSeats ? `（${minSeats} 席起）` : ""}`
    : `¥${techServiceFeeYuan}/月`;

  return (
    <div className="mt-4 space-y-2">
      {isTeamScope ? (
        teamTenants.length > 0 ? (
          <label className="block text-xs text-muted-foreground">
            开通到团队
            <select
              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
            >
              {teamTenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-xs text-muted-foreground">
            尚无团队？{" "}
            <Link href="/account/team" className="text-amber-600 underline dark:text-amber-400">
              先创建团队
            </Link>
          </p>
        )
      ) : null}

      <Button
        type="button"
        size="sm"
        className={cn(
          "w-full text-white",
          isTeamScope ? "bg-violet-600 hover:bg-violet-700" : "bg-amber-600 hover:bg-amber-700",
        )}
        disabled={isTeamScope && teamTenants.length === 0}
        onClick={() => void subscribe()}
      >
        {`开通 ${label}（${priceHint}）`}
      </Button>

      {message ? <p className="text-xs text-destructive">{message}</p> : null}

      <p className="text-[11px] text-muted-foreground">
        开通后请微信转账并填写备注码，管理员核对后到账；亦可在{" "}
        <Link href="/account/byok" className="underline">
          BYOK 管理
        </Link>{" "}
        绑定厂商 Key。
      </p>
    </div>
  );
}
