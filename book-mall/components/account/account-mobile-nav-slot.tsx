"use client";

import { useEffect, useState } from "react";
import { AccountNavMenu } from "@/components/account/account-nav-menu";

type Props = React.ComponentProps<typeof AccountNavMenu>;

/** 小屏左侧抽屉菜单（与桌面侧栏同一套导航） */
export function AccountMobileNavSlot(props: Props) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (!isMobile) return null;

  return <AccountNavMenu {...props} placement="drawer" />;
}
