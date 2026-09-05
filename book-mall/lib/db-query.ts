import {
  DbUnavailableError,
  isDbUnavailableError,
  isPrismaConnectionUnavailable,
  logDbUnavailable,
  toDbUnavailableError,
} from "@/lib/db-unavailable";

export { DbUnavailableError };

/** RSC / server 读库：连接级错误时返回 fallback，其它错误继续抛出 */
export async function runDbQuery<T>(
  scope: string,
  fn: () => Promise<T>,
  fallback?: T,
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (isDbUnavailableError(e) || isPrismaConnectionUnavailable(e)) {
      logDbUnavailable(scope, e);
      if (fallback !== undefined) return fallback;
      throw toDbUnavailableError(e);
    }
    throw e;
  }
}

/** API route：若非 DB 不可用则 rethrow，供 withApiDbGuard 使用 */
export function rethrowIfNotDbUnavailable(error: unknown): never {
  if (isDbUnavailableError(error) || isPrismaConnectionUnavailable(error)) {
    throw toDbUnavailableError(error);
  }
  throw error;
}
