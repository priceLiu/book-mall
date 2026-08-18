import { fetchQrPlatform } from "@/lib/qr-platform-fetch";
import type { QrWorkspaceDraft } from "@/lib/qr-template-types";

export type QrCreditsPreviewItem = {
  label: string;
  modelKey: string;
  credits: number;
};

export type QrCreditsPreview = {
  billingPersona: "PLATFORM_CREDIT";
  estimatedCredits: number | null;
  items?: QrCreditsPreviewItem[];
  balance?: number;
  reserved?: number;
  sufficient: boolean;
  label: string;
  reason?: string;
};

/** 点击产生时：余额/轻量包不足则返回提示文案，否则 null */
export function getQrCreditsInsufficientMessage(
  preview: QrCreditsPreview | null,
): string | null {
  if (!preview || preview.sufficient) return null;

  const available =
    preview.balance != null
      ? Math.max(0, preview.balance - (preview.reserved ?? 0))
      : null;

  if (preview.estimatedCredits != null) {
    return available != null
      ? `积分不足：约需 ${preview.estimatedCredits} 积分，可用 ${available} 积分`
      : "积分不足，请充值后再试";
  }

  return preview.reason ?? "暂无报价，请稍后再试或更换模型";
}

export async function postQrCreditsPreview(
  draft: QrWorkspaceDraft,
): Promise<QrCreditsPreview | null> {
  const res = await fetchQrPlatform(
    "/api/book-mall/api/platform/v1/quick-replica/credits-preview",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    },
  );
  if (!res.ok) return null;
  return (await res.json()) as QrCreditsPreview;
}
