import { getMainSiteOrigin } from "@/lib/site-origin";
import { verifyToolsJwt } from "@/lib/tools-jwt";

export type EcomToolsSessionPayload = {
  hasCookie: boolean;
  active: boolean;
  introspect: Record<string, unknown> | null;
  introspectStatus: number | null;
  tokenExpiresAt: number | null;
};

function jwtSecretReady(): string | null {
  const s = process.env.TOOLS_SSO_JWT_SECRET?.trim();
  return s && s.length >= 16 ? s : null;
}

function jwtIntrospectFallbackEnabled(): boolean {
  const raw = process.env.TOOLS_INTROSPECT_JWT_FALLBACK?.trim();
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  return process.env.NODE_ENV === "development";
}

function introspectTimeoutMs(): number {
  const raw = process.env.TOOLS_INTROSPECT_TIMEOUT_MS?.trim();
  if (raw && /^\d+$/.test(raw)) {
    return Math.min(Math.max(Number(raw), 3000), 60000);
  }
  return process.env.NODE_ENV === "development" ? 5_000 : 12_000;
}

function sessionFromVerifiedJwt(
  verified: NonNullable<ReturnType<typeof verifyToolsJwt>>,
): EcomToolsSessionPayload {
  return {
    hasCookie: true,
    active: true,
    introspect: {
      active: true,
      session_source: "jwt_fallback",
      sub: verified.sub,
      tier: verified.tier,
    },
    introspectStatus: 200,
    tokenExpiresAt: verified.exp,
  };
}

let inflight: Promise<EcomToolsSessionPayload> | null = null;
let inflightToken: string | null = null;

/**
 * 带超时与 JWT 兜底的 introspect；同 token 并发请求合并为一次上游调用。
 */
export async function fetchEcomToolsSessionWithIntrospect(
  token: string,
): Promise<EcomToolsSessionPayload> {
  const bearer = token.trim();
  if (!bearer) {
    return {
      hasCookie: false,
      active: false,
      introspect: null,
      introspectStatus: null,
      tokenExpiresAt: null,
    };
  }

  if (inflight && inflightToken === bearer) {
    return inflight;
  }

  inflightToken = bearer;
  inflight = (async () => {
    const origin = getMainSiteOrigin();
    const secret = jwtSecretReady();
    const verified = secret ? verifyToolsJwt(bearer, secret) : null;

    if (!origin) {
      if (verified && jwtIntrospectFallbackEnabled()) {
        return sessionFromVerifiedJwt(verified);
      }
      return {
        hasCookie: true,
        active: false,
        introspect: null,
        introspectStatus: null,
        tokenExpiresAt: verified?.exp ?? null,
      };
    }

    const timeoutMs = introspectTimeoutMs();
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(`${origin.replace(/\/$/, "")}/api/sso/tools/introspect`, {
        headers: { Authorization: `Bearer ${bearer}` },
        cache: "no-store",
        signal: ac.signal,
      });
      const introspect = (await res.json().catch(() => null)) as Record<
        string,
        unknown
      > | null;
      const active =
        res.ok && Boolean((introspect as { active?: boolean } | null)?.active);
      return {
        hasCookie: true,
        active,
        introspect,
        introspectStatus: res.status,
        tokenExpiresAt: verified?.exp ?? null,
      };
    } catch {
      if (verified && jwtIntrospectFallbackEnabled()) {
        return sessionFromVerifiedJwt(verified);
      }
      return {
        hasCookie: true,
        active: false,
        introspect: null,
        introspectStatus: null,
        tokenExpiresAt: verified?.exp ?? null,
      };
    } finally {
      clearTimeout(timer);
      inflight = null;
      inflightToken = null;
    }
  })();

  return inflight;
}
