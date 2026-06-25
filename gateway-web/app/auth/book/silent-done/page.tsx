"use client";

import { useEffect } from "react";

import { GATEWAY_SILENT_SSO_MESSAGE } from "@/lib/gateway-silent-sso";

/**
 * 静默换票回跳着陆页（隐藏 iframe 内打开）：
 * 此时新的 gateway_token Cookie 已写入 gateway 同源，通知父页面换票完成。
 */
export default function GatewaySilentSsoDonePage() {
  useEffect(() => {
    try {
      window.parent?.postMessage(
        { type: GATEWAY_SILENT_SSO_MESSAGE },
        window.location.origin,
      );
    } catch {
      /* ignore */
    }
  }, []);

  return null;
}
