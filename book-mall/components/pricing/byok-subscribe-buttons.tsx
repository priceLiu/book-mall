"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Props = {
  isLoggedIn: boolean;
  isTeamScope?: boolean;
};

/** 积分换算 1.0：BYOK 准入改会员订阅，不再单独收技术服务费。 */
export function ByokMembershipCta({ isLoggedIn, isTeamScope = false }: Props) {
  const router = useRouter();
  const href = isTeamScope ? "/pricing#team" : "/pricing#personal";

  return (
    <div className="mt-4 space-y-2">
      <Button
        type="button"
        size="sm"
        className="w-full"
        onClick={() => {
          if (!isLoggedIn) {
            router.push(`/login?callbackUrl=${encodeURIComponent(href)}`);
            return;
          }
          router.push(href);
        }}
      >
        {isTeamScope ? "开通团队会员订阅" : "开通个人会员订阅"}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        开通后于{" "}
        <Link href="/account/gateway" className="underline">
          Gateway
        </Link>{" "}
        绑定厂商 Key；超额编排从轻量包扣积分。
      </p>
    </div>
  );
}
