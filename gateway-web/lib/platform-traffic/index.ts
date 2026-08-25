/** @generated — 勿在此编辑；改 shared/platform-traffic 后运行 node scripts/sync-platform-traffic.mjs */

export { resolveBookMallOrigin } from "./book-mall-origin";
export { fireTrafficHit, fireTrafficHitFromRequest } from "./fire-traffic-hit";
export { shouldRecordTrafficHit } from "./should-record-traffic-hit";
export { isProbeTrafficPath, trafficHitKind } from "./classify-traffic-path";
export type { TrafficHitKind } from "./classify-traffic-path";
export { resolveToolsTokenUserId } from "./decode-tools-token-sub";
export {
  pickTrafficIngestSecret,
  platformTrafficIngestSecrets,
} from "./traffic-ingest-secret";
export type { FireTrafficHitInput, FireTrafficHitFromRequestOptions } from "./fire-traffic-hit";
export type { ShouldRecordTrafficHitInput } from "./should-record-traffic-hit";
