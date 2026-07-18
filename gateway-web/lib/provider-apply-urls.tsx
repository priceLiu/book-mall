/** 各厂商 API Key 申请入口（Gateway 控制台展示） */
export const PROVIDER_APPLY_URLS: Partial<
  Record<
    | "KIE"
    | "BAILIAN"
    | "DEEPSEEK"
    | "MOONSHOT"
    | "DASHSCOPE"
    | "HUNYUAN"
    | "VOLCENGINE"
    | "MINIMAX"
    | "ELEVENLABS"
    | "WORLDLABS"
    | "TOPAZ",
    string
  >
> = {
  KIE: "https://kie.ai/api-key",
  BAILIAN:
    "https://bailian.console.aliyun.com/cn-beijing?spm=5176.42028462.overview_recent.5.2124154amlfGdb&tab=model#/api-key",
  DEEPSEEK: "https://platform.deepseek.com/api_keys",
  MOONSHOT: "https://platform.kimi.com/console/api-keys",
  VOLCENGINE:
    "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey",
  MINIMAX: "https://platform.minimaxi.com/user-center/basic-information/interface-key",
  ELEVENLABS: "https://elevenlabs.io/app/settings/api-keys",
  WORLDLABS: "https://platform.worldlabs.ai/api-keys",
  TOPAZ: "https://account.topazlabs.com/manage-api",
};

export function providerApplyUrl(
  providerKind: string,
): string | undefined {
  return PROVIDER_APPLY_URLS[providerKind as keyof typeof PROVIDER_APPLY_URLS];
}

export function ProviderApplyLink({
  providerKind,
  className,
}: {
  providerKind: string;
  className?: string;
}) {
  const url = providerApplyUrl(providerKind);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={className ?? "text-[var(--gw-accent)] hover:underline"}
    >
      申请 API Key ↗
    </a>
  );
}
