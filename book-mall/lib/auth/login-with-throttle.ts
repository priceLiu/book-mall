import { normalizePhone } from "@/lib/auth/phone";
import {
  AuthThrottleError,
  assertLoginAllowed,
  recordLoginFailure,
  recordLoginSuccess,
} from "@/lib/auth/auth-throttle";
import {
  verifyCredentialsLogin,
  type CredentialsLoginInput,
  type VerifiedLoginUser,
} from "@/lib/auth/verify-credentials";

export { AuthThrottleError };

export type ThrottledLoginResult =
  | { ok: true; user: VerifiedLoginUser }
  | { ok: false; status: 401 | 429; error: string };

/**
 * 密码 / 短信登录：先限速再校验。autologin 票据不计入失败窗口。
 */
export async function verifyLoginWithThrottle(input: {
  credentials: CredentialsLoginInput | undefined;
  ip: string | null;
}): Promise<ThrottledLoginResult> {
  const loginMode = input.credentials?.loginMode?.trim() || "password";
  const phone = normalizePhone(input.credentials?.phone);
  const throttle = loginMode !== "autologin";

  if (throttle) {
    try {
      assertLoginAllowed(input.ip, phone);
    } catch (e) {
      if (e instanceof AuthThrottleError) {
        return { ok: false, status: 429, error: e.message };
      }
      throw e;
    }
  }

  const user = await verifyCredentialsLogin(input.credentials);
  if (!user) {
    if (throttle) recordLoginFailure(input.ip, phone);
    return {
      ok: false,
      status: 401,
      error: loginMode === "password" ? "手机号或密码错误" : "手机号或验证码错误",
    };
  }

  if (throttle) recordLoginSuccess(input.ip, phone);
  return { ok: true, user };
}
