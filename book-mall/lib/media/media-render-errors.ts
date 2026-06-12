import { Prisma } from "@prisma/client";

const USER_MESSAGE = "提交剪辑失败，请稍后重试";

/** 不把 Prisma 原始堆栈返回给终端用户 */
export function mediaRenderErrorMessage(err: unknown): string {
  if (err instanceof Prisma.PrismaClientValidationError) {
    const raw = err.message;
    if (/progressLabel|Unknown argument/i.test(raw)) {
      return "剪辑服务需要重启 book-mall 后重试（开发：重启 pnpm dev:all）";
    }
    if (/undefined/i.test(raw)) {
      return USER_MESSAGE;
    }
    return USER_MESSAGE;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return USER_MESSAGE;
  }
  if (err instanceof Error && err.message.trim()) {
    return err.message;
  }
  return USER_MESSAGE;
}
