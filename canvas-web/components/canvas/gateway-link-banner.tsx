"use client";

import { AlertTriangle } from "lucide-react";
import { useGatewayLinkStatus } from "@/lib/canvas/use-gateway-link-status";

export function GatewayLinkBanner() {
  const { loading, linked, status, accountUrl, gatewayConsoleUrl, gatewayGuideUrl } =
    useGatewayLinkStatus();

  if (loading || linked || !accountUrl) return null;

  const revoked = status?.revoked === true;

  return (
    <div
      role="alert"
      className="mx-3 mt-2 flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-100 shadow-sm"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
      <div className="space-y-1 leading-relaxed">
        <p className="font-medium">
          {revoked
            ? "Gateway API Key 已吊销，请重新关联后再运行 Canvas 生成"
            : "请先在 Gateway 控制台绑定厂商凭证，并在 Book 个人中心关联 sk-gw 密钥"}
        </p>
        <p className="text-amber-100/85">
          流程：Gateway 绑定 KIE / 百炼 / DeepSeek → 创建 sk-gw → Book 个人中心粘贴验证。
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <a
            href={gatewayGuideUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block font-medium text-amber-200 underline underline-offset-2 hover:text-white"
          >
            用户需知 →
          </a>
          <a
            href={gatewayConsoleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block font-medium text-amber-200 underline underline-offset-2 hover:text-white"
          >
            Gateway 控制台 →
          </a>
          <a
            href={accountUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block font-medium text-amber-200 underline underline-offset-2 hover:text-white"
          >
            Book 个人中心关联 →
          </a>
        </div>
      </div>
    </div>
  );
}
