/**
 * 用户选模时展示的「来源」标签（sourceLabel），与 providerKind / vendor 解耦。
 */
import type { GatewayProviderKind } from "@prisma/client";

import marketPresentation from "@/config/gateway-market-presentation.json";

const PRESENTATION = marketPresentation as {
  models?: Record<string, { providerLabel?: string }>;
};

const PROVIDER_KIND_SOURCE_LABEL: Partial<Record<GatewayProviderKind, string>> = {
  KIE: "第三方",
  VOLCENGINE: "平台",
  BAILIAN: "平台",
  DEEPSEEK: "平台",
  MOONSHOT: "平台",
  MINIMAX: "平台",
  TOPAZ: "第三方",
  ELEVENLABS: "第三方",
  HUNYUAN: "平台",
};

const VENDOR_SOURCE_LABEL: Record<string, string> = {
  kie: "第三方",
  volcengine: "平台",
  aliyun: "平台",
  deepseek: "平台",
  minimax: "平台",
  tencent: "平台",
};

export type ResolveSourceLabelInput = {
  canonicalModelKey: string;
  providerKind: GatewayProviderKind;
  vendor: string;
  /** ModelCatalog.sourceLabel 或 shelf sourceLabelOverride */
  catalogSourceLabel?: string | null;
  shelfSourceLabelOverride?: string | null;
};

/** 从 gateway-market-presentation.json 读取 providerLabel（seed 初始值）。 */
export function presentationSourceLabelFor(canonicalModelKey: string): string | null {
  const label = PRESENTATION.models?.[canonicalModelKey]?.providerLabel?.trim();
  return label || null;
}

/** 解析用户可见的来源标签。 */
export function resolveSourceLabel(input: ResolveSourceLabelInput): string {
  const override =
    input.shelfSourceLabelOverride?.trim() || input.catalogSourceLabel?.trim();
  if (override) return override;

  const fromKind = PROVIDER_KIND_SOURCE_LABEL[input.providerKind];
  if (fromKind) return fromKind;

  const vendor = input.vendor.trim().toLowerCase();
  const fromVendor = VENDOR_SOURCE_LABEL[vendor];
  if (fromVendor) return fromVendor;

  const fromPresentation = presentationSourceLabelFor(input.canonicalModelKey);
  if (fromPresentation) return fromPresentation;

  return input.providerKind;
}
