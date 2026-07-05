import { getAppPublicOrigin, getMainSiteOrigin } from "@/lib/site-origin";

/** SSO 换票所需环境变量（服务端 runtime 读取，与 book-mall 一致） */
export function exchangeSecret(): string | null {
  const s = process.env.TOOLS_SSO_SERVER_SECRET?.trim();
  return s && s.length >= 16 ? s : null;
}

/** 运维诊断：只暴露长度，不暴露密钥明文 */
export function ssoExchangeEnvStatus() {
  const mainOrigin = getMainSiteOrigin();
  const appOrigin = getAppPublicOrigin();
  const exchangeRaw = process.env.TOOLS_SSO_SERVER_SECRET?.trim() ?? "";
  const jwtRaw = process.env.TOOLS_SSO_JWT_SECRET?.trim() ?? "";

  return {
    service: "e-commerce-toolkit",
    mainOriginConfigured: Boolean(mainOrigin),
    mainOrigin,
    appPublicOriginConfigured: Boolean(appOrigin),
    appPublicOrigin: appOrigin,
    exchangeSecretLength: exchangeRaw.length,
    exchangeSecretOk: exchangeRaw.length >= 16,
    jwtSecretLength: jwtRaw.length,
    jwtSecretOk: jwtRaw.length >= 16,
    ready: Boolean(mainOrigin && appOrigin && exchangeRaw.length >= 16),
  };
}
