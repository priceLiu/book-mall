import fs from "fs";
import path from "path";

export interface WechatPayConfig {
  mchid: string;
  mchName: string;
  apiV3Key: string;
  serialNo: string;
  certPath: string;
  keyPath: string;
  notifyUrl: string;
}

let _config: WechatPayConfig | null = null;

export function getWechatPayConfig(): WechatPayConfig {
  if (_config) return _config;

  const mchid = process.env.WECHAT_PAY_MCHID?.trim();
  const mchName = process.env.WECHAT_PAY_MCH_NAME?.trim();
  const apiV3Key = process.env.WECHAT_PAY_API_V3_KEY?.trim();
  const serialNo = process.env.WECHAT_PAY_SERIAL_NO?.trim();
  const certPath = process.env.WECHAT_PAY_CERT_PATH?.trim();
  const keyPath = process.env.WECHAT_PAY_KEY_PATH?.trim();
  const notifyUrl = process.env.WECHAT_PAY_NOTIFY_URL?.trim();

  if (!mchid || !apiV3Key || !serialNo || !certPath || !keyPath || !notifyUrl) {
    throw new Error("微信支付配置不完整，请检查 WECHAT_PAY_* 环境变量");
  }

  _config = { mchid, mchName: mchName ?? "", apiV3Key, serialNo, certPath, keyPath, notifyUrl };
  return _config;
}

export function readPrivateKey(): string {
  const cfg = getWechatPayConfig();
  const resolved = path.resolve(cfg.keyPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`商户私钥文件不存在: ${resolved}`);
  }
  return fs.readFileSync(resolved, "utf8");
}

export function isWechatPayConfigured(): boolean {
  try {
    getWechatPayConfig();
    return true;
  } catch {
    return false;
  }
}
