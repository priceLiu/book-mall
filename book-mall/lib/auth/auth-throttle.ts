/**
 * 登录失败 / 短信突发限速（进程内滑动窗口）。
 * 多实例时每实例独立计数，仍显著低于无限重试。
 */

export class AuthThrottleError extends Error {
  readonly status = 429 as const;

  constructor(message = "尝试次数过多，请稍后再试") {
    super(message);
    this.name = "AuthThrottleError";
  }
}

export type AuthThrottleWindow = {
  windowMs: number;
  max: number;
  blockMs?: number;
};

export const LOGIN_FAIL_IP: AuthThrottleWindow = {
  windowMs: 15 * 60_000,
  max: 20,
  blockMs: 15 * 60_000,
};

export const LOGIN_FAIL_PHONE: AuthThrottleWindow = {
  windowMs: 15 * 60_000,
  max: 8,
  blockMs: 15 * 60_000,
};

export const SMS_BURST_IP: AuthThrottleWindow = {
  windowMs: 10 * 60_000,
  max: 8,
};

type Bucket = { times: number[]; blockedUntil: number };

const store = new Map<string, Bucket>();
let nowFn = () => Date.now();

function now(): number {
  return nowFn();
}

function bucket(key: string): Bucket {
  return store.get(key) ?? { times: [], blockedUntil: 0 };
}

function prune(b: Bucket, windowMs: number): number[] {
  const t = now();
  return b.times.filter((x) => t - x < windowMs);
}

export function assertNotThrottled(key: string, cfg: AuthThrottleWindow): void {
  const t = now();
  const b = bucket(key);
  if (b.blockedUntil > t) {
    throw new AuthThrottleError();
  }
  const times = prune(b, cfg.windowMs);
  if (times.length >= cfg.max) {
    store.set(key, {
      times,
      blockedUntil: cfg.blockMs ? t + cfg.blockMs : 0,
    });
    throw new AuthThrottleError();
  }
  store.set(key, { times, blockedUntil: b.blockedUntil > t ? b.blockedUntil : 0 });
}

export function recordThrottleHit(key: string, cfg: AuthThrottleWindow): void {
  const t = now();
  const b = bucket(key);
  const times = prune(b, cfg.windowMs);
  times.push(t);
  let blockedUntil = b.blockedUntil > t ? b.blockedUntil : 0;
  if (times.length >= cfg.max && cfg.blockMs) {
    blockedUntil = t + cfg.blockMs;
  }
  store.set(key, { times, blockedUntil });
}

/** 消耗一次配额；超限返回 true（不抛）。用于短信发送。 */
export function consumeRateLimit(key: string, cfg: AuthThrottleWindow): boolean {
  try {
    assertNotThrottled(key, cfg);
  } catch (e) {
    if (e instanceof AuthThrottleError) return true;
    throw e;
  }
  recordThrottleHit(key, cfg);
  return false;
}

export function clearThrottle(key: string): void {
  store.delete(key);
}

export function assertLoginAllowed(ip: string | null, phone: string | null): void {
  if (ip) assertNotThrottled(`login:ip:${ip}`, LOGIN_FAIL_IP);
  if (phone) assertNotThrottled(`login:phone:${phone}`, LOGIN_FAIL_PHONE);
}

export function recordLoginFailure(ip: string | null, phone: string | null): void {
  if (ip) recordThrottleHit(`login:ip:${ip}`, LOGIN_FAIL_IP);
  if (phone) recordThrottleHit(`login:phone:${phone}`, LOGIN_FAIL_PHONE);
}

export function recordLoginSuccess(ip: string | null, phone: string | null): void {
  if (phone) clearThrottle(`login:phone:${phone}`);
  if (ip) clearThrottle(`login:ip:${ip}`);
}

export function resetAuthThrottleForTests(): void {
  store.clear();
  nowFn = () => Date.now();
}

export function setAuthThrottleNowForTests(fn: () => number): void {
  nowFn = fn;
}
