/**
 * 私域人像库 · IAM Access Key（AK/SK），与 ark- Bearer API Key 分离
 * @deprecated 实现已迁至 volcengine-gateway-credential.ts · 保留 re-export
 */

export type VolcenginePortraitCredentials = import("./volcengine-gateway-credential").VolcenginePortraitIam;

export {
  buildVolcengineCredentialStorage,
  parseVolcengineGatewayCredential,
  parseVolcenginePortraitCredentialsFromApiKey,
  resolveVolcengineArkApiKey,
  resolveVolcenginePortraitCredentials,
  resolveVolcenginePortraitCredentialsFromEnv,
  type ParsedVolcengineGatewayCredential,
  type VolcenginePortraitIam,
} from "./volcengine-gateway-credential";
