/** Prisma 写入 AI 试衣表时的可读错误（避免 500 无说明） */

export const AI_FIT_TABLES_MISSING_MESSAGE =
  "数据库尚未创建 AI 试衣相关表。请在 book-mall 目录执行：pnpm prisma migrate deploy（本地开发：pnpm db:migrate）。";

export function prismaErrorCode(e: unknown): string | undefined {
  if (e && typeof e === "object" && "code" in e) {
    const c = (e as { code?: unknown }).code;
    return typeof c === "string" ? c : undefined;
  }
  return undefined;
}
