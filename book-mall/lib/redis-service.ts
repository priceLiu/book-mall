/**
 * 租户并发限流（轨道 D · 里程碑 7）
 *
 * 用 Redis 原子计数器维护「租户当前并发任务数」，请求前 acquire（占用 +1，超限拒绝），
 * 结束后 release（-1）。键 `tenant:{id}:run_num`，上限取 Tenant.maxConcurrency。
 *
 * 渐进式：未配置 REDIS_URL 时全部 no-op（allow），不影响其余功能（与计划「无 Redis 也能先跑通」一致）。
 * ioredis 为可选依赖，仅在配置 REDIS_URL 时动态加载；加载失败亦降级为 allow。
 */

type RedisLike = {
  eval: (script: string, numKeys: number, ...args: (string | number)[]) => Promise<unknown>;
  decr: (key: string) => Promise<number>;
  expire: (key: string, sec: number) => Promise<number>;
  get: (key: string) => Promise<string | null>;
};

let clientPromise: Promise<RedisLike | null> | null = null;

function redisUrl(): string | null {
  const u = process.env.REDIS_URL?.trim();
  return u || null;
}

export function isConcurrencyEnabled(): boolean {
  return !!redisUrl();
}

async function getClient(): Promise<RedisLike | null> {
  const url = redisUrl();
  if (!url) return null;
  if (!clientPromise) {
    clientPromise = (async () => {
      try {
        // 动态导入，避免无 Redis 环境强依赖
        const mod = (await import("ioredis")) as unknown as {
          default: new (url: string, opts?: Record<string, unknown>) => RedisLike;
        };
        const Redis = mod.default;
        return new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: false });
      } catch (e) {
        console.warn("[redis] ioredis 不可用，并发限流降级为放行", e);
        return null;
      }
    })();
  }
  return clientPromise;
}

function keyOf(tenantId: string): string {
  return `tenant:${tenantId}:run_num`;
}

// 原子占用：当前值 < max 才 +1；返回占用后的计数（-1 表示超限被拒）
const ACQUIRE_LUA = `
local cur = tonumber(redis.call('GET', KEYS[1]) or '0')
local max = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
if cur < max then
  local n = redis.call('INCR', KEYS[1])
  redis.call('EXPIRE', KEYS[1], ttl)
  return n
else
  return -1
end`;

export interface AcquireResult {
  ok: boolean;
  enforced: boolean; // 是否真正经过 Redis 限流
  current?: number;
  max?: number;
}

/**
 * 占用一个并发槽。无 Redis 或 max<=0 时直接放行（enforced=false）。
 * ttlSec 为槽自动过期兜底（避免 release 丢失导致泄漏），默认 600s。
 */
export async function acquireTenantSlot(input: {
  tenantId: string;
  max: number;
  ttlSec?: number;
}): Promise<AcquireResult> {
  if (!input.tenantId || input.max <= 0) return { ok: true, enforced: false };
  const client = await getClient();
  if (!client) return { ok: true, enforced: false };
  try {
    const n = (await client.eval(
      ACQUIRE_LUA,
      1,
      keyOf(input.tenantId),
      input.max,
      input.ttlSec ?? 600,
    )) as number;
    if (n === -1) {
      return { ok: false, enforced: true, current: input.max, max: input.max };
    }
    return { ok: true, enforced: true, current: n, max: input.max };
  } catch (e) {
    console.warn("[redis] acquire 失败，降级放行", e);
    return { ok: true, enforced: false };
  }
}

/** 释放一个并发槽（幂等地不降到负数）。 */
export async function releaseTenantSlot(tenantId: string): Promise<void> {
  if (!tenantId) return;
  const client = await getClient();
  if (!client) return;
  try {
    const n = await client.decr(keyOf(tenantId));
    if (n < 0) {
      // 兜底：纠正为 0
      await client.eval("redis.call('SET', KEYS[1], '0')", 1, keyOf(tenantId));
    }
  } catch (e) {
    console.warn("[redis] release 失败（忽略）", e);
  }
}

/** 查询租户当前并发数（无 Redis 返回 null）。 */
export async function getTenantConcurrency(tenantId: string): Promise<number | null> {
  const client = await getClient();
  if (!client) return null;
  try {
    const v = await client.get(keyOf(tenantId));
    return v ? Number(v) : 0;
  } catch {
    return null;
  }
}
