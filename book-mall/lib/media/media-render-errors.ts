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
    if (/Response timeout for 60000ms/i.test(err.message)) {
      return "成片上传云端超时，请稍后重试或降低输出画质；若多次失败请联系客服。";
    }
    if (/maxBuffer length exceeded|stderr maxBuffer/i.test(err.message)) {
      return "剪辑进程输出异常，请稍后重试；若多次失败请联系客服。";
    }
    if (/fetch failed|failed to fetch|下载源片失败|下载失败 HTTP/i.test(err.message)) {
      return "下载分镜视频失败，请确认视频链接可访问后重试。";
    }
    if (/执行超时/i.test(err.message)) {
      return "剪辑耗时过长已超时，请减少分镜数量或降低输出画质后重试。";
    }
    if (/剪辑任务超时/i.test(err.message)) {
      return err.message;
    }
    return err.message;
  }
  return USER_MESSAGE;
}
