import type { GenerationUserFacingBucket as GenerationUserFacingBucketEnum } from "@prisma/client";
import {
  classifyGenerationUserFacingBucket,
  type GenerationUserFacingBucket,
} from "@private/generation-user-facing-error";
import { recordGatewayPlatformError } from "@/lib/platform-error-log";

const BUCKET_TO_PRISMA: Record<
  GenerationUserFacingBucket,
  GenerationUserFacingBucketEnum
> = {
  USER_CREDITS: "USER_CREDITS",
  PLATFORM_BILLING: "PLATFORM_BILLING",
  VENDOR_INPUT: "VENDOR_INPUT",
  VENDOR_QUEUE: "VENDOR_QUEUE",
};

export function prismaUserFacingBucketFromFailure(input: {
  failCode?: string | null;
  failMessage?: string | null;
  httpStatus?: number | null;
}): GenerationUserFacingBucketEnum | undefined {
  const bucket = classifyGenerationUserFacingBucket(input);
  return BUCKET_TO_PRISMA[bucket];
}

export function resolveUserFacingBucket(
  stored: GenerationUserFacingBucketEnum | null | undefined,
  input: {
    failCode?: string | null;
    failMessage?: string | null;
    httpStatus?: number | null;
  },
): GenerationUserFacingBucket {
  if (stored) {
    return stored as GenerationUserFacingBucket;
  }
  return classifyGenerationUserFacingBucket(input);
}

export function recordUserFacingBucketFeedback(opts: {
  logId: string;
  bucket: GenerationUserFacingBucket;
  failCode?: string | null;
  failMessage?: string | null;
  model?: string | null;
  clientPage?: string | null;
  userId?: string | null;
}): void {
  if (opts.bucket !== "PLATFORM_BILLING" && opts.bucket !== "VENDOR_QUEUE") return;
  recordGatewayPlatformError({
    logId: opts.logId,
    failCode: `USER_FACING_${opts.bucket}`,
    failMessage: opts.failMessage,
    model: opts.model,
    clientPage: opts.clientPage,
    userId: opts.userId,
  });
}