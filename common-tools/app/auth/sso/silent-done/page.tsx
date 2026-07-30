"use client";

import { useEffect } from "react";

/** @deprecated 静默换票已改为 refresh API + 整页 re-enter；保留页面避免旧链 404 */
const LEGACY_MESSAGE = "ecom-sso-refreshed";

/**
 * 静默换票回跳着陆页（legacy iframe 流程）。
 */
export default function EcomSilentSsoDonePage() {
  useEffect(() => {
    try {
      window.parent?.postMessage(
        { type: LEGACY_MESSAGE },
        window.location.origin,
      );
    } catch {
      /* ignore */
    }
  }, []);

  return null;
}
