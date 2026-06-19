import type { GenerationTrafficState } from "@prisma/client";

import {
  computeTokenBurst,
  getActorDispatchMinMs,
  getTrafficTokensPerSec,
} from "./constants";

export function refillTokenBucket(
  state: Pick<
    GenerationTrafficState,
    "dispatchTokens" | "lastTokenRefillAt" | "maxConcurrency" | "tokensPerSec"
  >,
  now = Date.now(),
): number {
  const burst = computeTokenBurst(state.maxConcurrency);
  const rate = state.tokensPerSec > 0 ? state.tokensPerSec : getTrafficTokensPerSec();
  const elapsedSec = Math.max(
    0,
    (now - state.lastTokenRefillAt.getTime()) / 1000,
  );
  return Math.min(burst, state.dispatchTokens + elapsedSec * rate);
}

export function spacingBlocked(
  lastDispatchAt: Date | null | undefined,
  now = Date.now(),
): boolean {
  if (!lastDispatchAt) return false;
  return now - lastDispatchAt.getTime() < getActorDispatchMinMs();
}

export function nextDispatchAfterFromSpacing(
  lastDispatchAt: Date | null | undefined,
): Date {
  const minMs = getActorDispatchMinMs();
  if (!lastDispatchAt) return new Date();
  return new Date(lastDispatchAt.getTime() + minMs);
}
