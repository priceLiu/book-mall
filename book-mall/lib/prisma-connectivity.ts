import { isPrismaConnectionUnavailable } from "@/lib/db-unavailable";

/** @deprecated 使用 isPrismaConnectionUnavailable（已含 P1002/P1008/P2024） */
export function isPrismaConnectivityError(e: unknown): boolean {
  return isPrismaConnectionUnavailable(e);
}
