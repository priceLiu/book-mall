/**
 * @deprecated 使用 canonical-registry.ts。保留 re-export 以免旧 import 断裂。
 */
import {
  GATEWAY_CANONICAL_REGISTRY,
  PLATFORM_MEDIA_DEFAULTS,
  PLATFORM_MEDIA_KIND_LABEL,
  canonicalByKey,
  canonicalsForAppTag,
  type CanonicalModelDef,
  type CanonicalRouteDef,
  type PlatformMediaKind,
} from "@/lib/platform-model/canonical-registry";

export {
  GATEWAY_CANONICAL_REGISTRY,
  PLATFORM_MEDIA_DEFAULTS,
  PLATFORM_MEDIA_KIND_LABEL,
  canonicalByKey,
  canonicalsForAppTag,
  type CanonicalModelDef,
  type CanonicalRouteDef,
  type PlatformMediaKind,
};

export { GATEWAY_CANONICAL_REGISTRY as PLATFORM_SCENARIO_REGISTRY };

export function resolveOfferingAppKey(appKey: string): string {
  void appKey;
  return "platform";
}

export function scenariosForApp(appTag: string) {
  return canonicalsForAppTag(appTag);
}
