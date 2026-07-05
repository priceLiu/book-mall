/** SSO 换票所需环境变量（服务端 runtime 读取，与 book-mall 一致） */
export function exchangeSecret(): string | null {
  const s = process.env.TOOLS_SSO_SERVER_SECRET?.trim();
  return s && s.length >= 16 ? s : null;
}

/** 运维诊断：只暴露长度，不暴露密钥明文 */
export function ssoExchangeEnvStatus() {
  const mainRaw =
    process.env.MAIN_SITE_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_BOOK_MALL_URL?.trim() ||
    process.env.BOOK_MALL_URL?.trim() ||
    "";
  const exchangeRaw = process.env.TOOLS_SSO_SERVER_SECRET?.trim() ?? "";
  const jwtRaw = process.env.TOOLS_SSO_JWT_SECRET?.trim() ?? "";
  const appRaw =
    process.env.STORY_PUBLIC_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_STORY_WEB_ORIGIN?.trim() ||
    "";

  return {
    service: "story-web",
    mainOriginConfigured: Boolean(mainRaw),
    appPublicOriginConfigured: Boolean(appRaw),
    exchangeSecretLength: exchangeRaw.length,
    exchangeSecretOk: exchangeRaw.length >= 16,
    jwtSecretLength: jwtRaw.length,
    jwtSecretOk: jwtRaw.length >= 16,
    ready: Boolean(mainRaw && appRaw && exchangeRaw.length >= 16),
  };
}
