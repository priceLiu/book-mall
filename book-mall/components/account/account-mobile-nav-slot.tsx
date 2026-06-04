"use client";

import { useEffect, useState } from "react";
import { AccountNavMenu } from "@/components/account/account-nav-menu";

type Props = React.ComponentProps<typeof AccountNavMenu>;

/** 仅在小屏挂载 Ark 下拉，避免桌面端 Portal 在页面底部重复渲染菜单 */
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

  return <AccountNavMenu {...props} placement="header" />;
}
