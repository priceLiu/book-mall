import type { Prisma } from "@prisma/client";

/** Prisma Json 字段不接受 `undefined`；统一去掉后再写入。 */
export function prismaJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
