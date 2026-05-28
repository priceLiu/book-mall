/** 主站 Cookie 同意偏好（localStorage，供前端脚本与后续分析工具读取） */

export const COOKIE_CONSENT_STORAGE_KEY = "book-mall-cookie-consent-v1";

export type CookieConsentChoice = "accepted" | "rejected" | "custom";

export type CookieConsentRecord = {
  choice: CookieConsentChoice;
  /** 分析类（如流量统计） */
  analytics: boolean;
  /** 营销 / 个性化 */
  marketing: boolean;
  decidedAt: string;
};

export function readCookieConsent(): CookieConsentRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsentRecord;
    if (!parsed?.decidedAt || typeof parsed.analytics !== "boolean") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeCookieConsent(record: CookieConsentRecord): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(record));
    window.dispatchEvent(new CustomEvent("book-mall-cookie-consent-change"));
  } catch {
    /* ignore quota */
  }
}

export function hasCookieConsentDecision(): boolean {
  return readCookieConsent() !== null;
}
