/** 微信个人收款码静态资源配置 */
export function getWechatPersonalQrUrl(): string {
  return process.env.WECHAT_PERSONAL_QR_URL?.trim() || "/payments/wechat-personal-qr.png";
}

export function getWechatPayeeName(): string {
  return process.env.WECHAT_PAYEE_NAME?.trim() || "刘春宇";
}

export function checkoutExpiresHours(): number {
  const raw = Number(process.env.PAYMENT_CHECKOUT_EXPIRE_HOURS ?? "24");
  return Number.isFinite(raw) && raw > 0 ? raw : 24;
}
