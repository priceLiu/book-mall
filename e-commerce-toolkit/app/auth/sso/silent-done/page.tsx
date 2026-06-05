"use client";

import { useEffect } from "react";

import { ECOM_SILENT_SSO_MESSAGE } from "@/lib/ecom-silent-sso";

/**
 * 静默换票回跳着陆页（隐藏 iframe 内打开）：
 * 此时新的 tools_token Cookie 已写入 ecom 同源，通知父页面换票完成。
 */
export default function EcomSilentSsoDonePage() {
  useEffect(() => {
    try {
      window.parent?.postMessage(
        { type: ECOM_SILENT_SSO_MESSAGE },
        window.location.origin,
      );
    } catch {
      /* ignore */
    }
  }, []);

  return null;
}
