import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getWechatPayConfig, readPrivateKey } from "./wechat-pay-config";

const WECHAT_API_BASE = "https://api.mch.weixin.qq.com";

// ─── 签名 ───────────────────────────────────────────────

function sign(method: string, urlPath: string, timestamp: number, nonce: string, body: string): string {
  const privateKey = readPrivateKey();
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${body}\n`;
  return crypto.createSign("RSA-SHA256").update(message).sign(privateKey, "base64");
}

// ─── Authorization 头 ───────────────────────────────────

function authorization(method: string, urlPath: string, body: string): string {
  const cfg = getWechatPayConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString("hex");
  const signature = sign(method, urlPath, timestamp, nonce, body);
  return (
    `WECHATPAY2-SHA256-RSA2048 mchid="${cfg.mchid}",` +
    `nonce_str="${nonce}",timestamp="${timestamp}",` +
    `serial_no="${cfg.serialNo}",signature="${signature}"`
  );
}

// ─── 微信支付公钥（用于验签响应和回调） ──────────────────

let _pubKeyCache: string | null = null;

function readWechatPayPublicKey(): string {
  if (_pubKeyCache) return _pubKeyCache;
  const cfg = getWechatPayConfig();
  const resolved = path.resolve(cfg.pubKeyPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`微信支付公钥文件不存在: ${resolved}`);
  }
  _pubKeyCache = fs.readFileSync(resolved, "utf8");
  return _pubKeyCache;
}

// ─── HTTP 请求 ──────────────────────────────────────────

interface ApiResponse<T = unknown> {
  status: number;
  headers: Record<string, string>;
  body: T;
}

async function request<T = unknown>(
  method: string,
  urlPath: string,
  body?: Record<string, unknown>,
): Promise<ApiResponse<T>> {
  const bodyStr = body ? JSON.stringify(body) : "";
  const url = `${WECHAT_API_BASE}${urlPath}`;

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Language": "zh-CN",
      Authorization: authorization(method, urlPath, bodyStr),
      "User-Agent": "AI-Mall/1.0",
    },
    body: bodyStr || undefined,
  });

  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => (headers[k] = v));

  let resBody: T;
  const text = await res.text();
  try {
    resBody = text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    resBody = text as unknown as T;
  }

  if (res.status >= 400) {
    const err = resBody as { code?: string; message?: string };
    throw new Error(`微信支付错误 [${err.code ?? res.status}]: ${err.message ?? text}`);
  }

  // 验签（Wechatpay-Signature）
  verifyResponseSignature(headers, text);

  return { status: res.status, headers, body: resBody };
}

// ─── 响应验签 ───────────────────────────────────────────

function verifyResponseSignature(headers: Record<string, string>, body: string): void {
  const sig = headers["wechatpay-signature"];
  if (!sig) return;

  const timestamp = headers["wechatpay-timestamp"];
  const nonce = headers["wechatpay-nonce"];

  if (!timestamp || !nonce) return;

  const message = `${timestamp}\n${nonce}\n${body}\n`;
  const pubKey = readWechatPayPublicKey();

  const ok = crypto.createVerify("RSA-SHA256").update(message).verify(pubKey, sig, "base64");
  if (!ok) throw new Error("微信支付响应验签失败");
}

// ─── API 接口 ───────────────────────────────────────────

/** 创建 Native 支付订单 */
export async function createNativeOrder(params: {
  outTradeNo: string;
  description: string;
  amountYuan: number;
  notifyUrl?: string;
}): Promise<{ codeUrl: string }> {
  const cfg = getWechatPayConfig();
  const amountFen = Math.round(params.amountYuan * 100);

  const res = await request<{ code_url: string }>("POST", "/v3/pay/transactions/native", {
    appid: cfg.appId,
    mchid: cfg.mchid,
    description: params.description.slice(0, 42),
    out_trade_no: params.outTradeNo,
    notify_url: params.notifyUrl || cfg.notifyUrl,
    amount: {
      total: amountFen,
      currency: "CNY",
    },
  });

  return { codeUrl: res.body.code_url };
}

/** 查询订单 */
export async function queryOrder(outTradeNo: string): Promise<{
  tradeState: string;
  transactionId?: string;
  tradeStateDesc: string;
  amountTotalFen?: number;
}> {
  const cfg = getWechatPayConfig();
  const urlPath = `/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${cfg.mchid}`;
  const res = await request<{
    trade_state: string;
    transaction_id?: string;
    trade_state_desc: string;
    amount?: { total?: number };
  }>("GET", urlPath);

  return {
    tradeState: res.body.trade_state,
    transactionId: res.body.transaction_id,
    tradeStateDesc: res.body.trade_state_desc,
    amountTotalFen: res.body.amount?.total,
  };
}

/** 关闭订单 */
export async function closeOrder(outTradeNo: string): Promise<void> {
  const cfg = getWechatPayConfig();
  await request("POST", `/v3/pay/transactions/out-trade-no/${outTradeNo}/close`, {
    mchid: cfg.mchid,
  });
}

/** 申请退款 */
export async function applyRefund(params: {
  outTradeNo: string;
  outRefundNo: string;
  amountYuan: number;
  totalYuan: number;
  reason?: string;
}): Promise<{ refundId: string; status: string }> {
  const refundFen = Math.round(params.amountYuan * 100);
  const totalFen = Math.round(params.totalYuan * 100);

  const res = await request<{ refund_id: string; status: string }>("POST", "/v3/refund/domestic/refunds", {
    out_trade_no: params.outTradeNo,
    out_refund_no: params.outRefundNo,
    reason: params.reason?.slice(0, 80) || "用户退款",
    amount: {
      refund: refundFen,
      total: totalFen,
      currency: "CNY",
    },
  });

  return { refundId: res.body.refund_id, status: res.body.status };
}

/** 解密回调通知体 */
export function decryptNotifyResource(
  associatedData: string,
  nonce: string,
  ciphertext: string,
): Record<string, unknown> {
  const key = getWechatPayConfig().apiV3Key;

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(key, "utf8"),
    Buffer.from(nonce, "utf8"),
  );
  decipher.setAAD(Buffer.from(associatedData, "utf8"));
  decipher.setAuthTag(Buffer.from(ciphertext, "base64").slice(-16));
  const encrypted = Buffer.from(ciphertext, "base64").slice(0, -16);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}

/** 验证回调签名 */
export function verifyNotifySignature(
  timestamp: string,
  nonce: string,
  body: string,
  signature: string,
  _serial?: string,
): boolean {
  const message = `${timestamp}\n${nonce}\n${body}\n`;
  const pubKey = readWechatPayPublicKey();
  return crypto.createVerify("RSA-SHA256").update(message).verify(pubKey, signature, "base64");
}
