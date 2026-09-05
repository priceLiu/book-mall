import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { navKeysFromActiveToolServicePeriods } from "@/lib/tool-service-fee/periods";
import { resolveToolsNavKeysForUser } from "@/lib/tool-subscription-entitlements";
import { getToolsSsoEligibility } from "@/lib/tools-sso-access";

export const PUBLISHER_NAV_KEY = "social-publisher" as const;

export const PUBLISHER_PLATFORMS = [
  "xiaohongshu",
  "douyin",
  "weibo",
  "bilibili",
  "wechat_mp",
] as const;

export type PublisherPlatform = (typeof PUBLISHER_PLATFORMS)[number];

const JOB_TICKET_TTL_SEC = 15 * 60;

function jobTicketSecret(): string | null {
  const s = process.env.TOOLS_JWT_SECRET?.trim() ?? process.env.NEXTAUTH_SECRET?.trim();
  return s && s.length >= 16 ? s : null;
}

export async function userHasPublisherAccess(userId: string): Promise<boolean> {
  const elig = await getToolsSsoEligibility(userId);
  if (elig.isAdmin) return true;

  const memberNav = await resolveToolsNavKeysForUser(userId);
  if (memberNav.keys.includes(PUBLISHER_NAV_KEY)) return true;

  const periodNav = await navKeysFromActiveToolServicePeriods(userId);
  return periodNav.includes(PUBLISHER_NAV_KEY);
}

export function signPublisherJobTicket(input: {
  jobId: string;
  userId: string;
  platforms: PublisherPlatform[];
  expSec?: number;
}): string | null {
  const secret = jobTicketSecret();
  if (!secret) return null;

  const now = Math.floor(Date.now() / 1000);
  const exp = now + (input.expSec ?? JOB_TICKET_TTL_SEC);
  const payload = JSON.stringify({
    jid: input.jobId,
    uid: input.userId,
    pl: input.platforms,
    exp,
    iat: now,
  });
  const b64 = Buffer.from(payload).toString("base64url");
  const sig = createHmac("sha256", secret).update(b64).digest("base64url");
  return `${b64}.${sig}`;
}

export type VerifiedJobTicket = {
  jobId: string;
  userId: string;
  platforms: PublisherPlatform[];
  exp: number;
};

export function verifyPublisherJobTicket(token: string): VerifiedJobTicket | null {
  const secret = jobTicketSecret();
  if (!secret) return null;

  const parts = token.trim().split(".");
  if (parts.length !== 2) return null;
  const [b64, sig] = parts;
  const expected = createHmac("sha256", secret).update(b64).digest("base64url");
  try {
    if (
      expected.length !== sig.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
    ) {
      return null;
    }
  } catch {
    return null;
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(Buffer.from(b64, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }

  const exp = typeof raw.exp === "number" ? raw.exp : 0;
  if (exp * 1000 < Date.now()) return null;

  const jobId = typeof raw.jid === "string" ? raw.jid : "";
  const userId = typeof raw.uid === "string" ? raw.uid : "";
  if (!jobId || !userId) return null;

  const platforms: PublisherPlatform[] = [];
  if (Array.isArray(raw.pl)) {
    for (const p of raw.pl) {
      if (
        typeof p === "string" &&
        (PUBLISHER_PLATFORMS as readonly string[]).includes(p)
      ) {
        platforms.push(p as PublisherPlatform);
      }
    }
  }
  if (platforms.length === 0) return null;

  return { jobId, userId, platforms, exp };
}

export function newPublisherJobId(): string {
  return `pub_${randomBytes(12).toString("hex")}`;
}
