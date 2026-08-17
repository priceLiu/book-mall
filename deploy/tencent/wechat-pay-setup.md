# 企业微信支付 · CloudBase 配置（book-mall）

管理员专用轻量包等须 **Native 扫码支付**。私钥 **不能打进 Git**，须用环境变量注入。

## 一键生成 CloudBase 变量（本地）

本机已有 `book-mall/certs/apiclient_key.pem` 时：

```bash
cd book-mall
pnpm wechat-pay:cloudbase-env
```

会生成 **`deploy/tencent/wechat-pay-cloudbase.env.patch`**（已 gitignore，勿提交）。

## CloudBase 控制台要配的项

在 **book-mall 服务 → 环境变量** 中确认：

| 变量 | 说明 |
|------|------|
| `WECHAT_PAY_MCHID` | 商户号 |
| `WECHAT_PAY_APP_ID` | AppID |
| `WECHAT_PAY_API_V3_KEY` | APIv3 密钥 |
| `WECHAT_PAY_SERIAL_NO` | 证书序列号 |
| `WECHAT_PAY_NOTIFY_URL` | `https://book.ai-code8.com/api/payments/wechat/notify`（须完整） |
| `WECHAT_PAY_KEY_PATH` | `certs/apiclient_key.pem`（可保留） |
| `WECHAT_PAY_PUB_KEY_PATH` | `certs/wechat_pay_pub_key.pem` |
| **`WECHAT_PAY_PRIVATE_KEY_B64`** | **从 patch 文件复制整行** |

`WECHAT_PAY_CERT_PATH` 可选，Native 支付签名不依赖。

## 发版

1. 推送包含微信支付 env 支持的 book-mall 代码  
2. CloudBase 重新构建 **book-mall**  
3. **重启服务**  
4. 启动日志应有：`WeChat Pay private key materialized -> /app/certs/apiclient_key.pem`

## 微信商户平台

支付配置 → Native 支付 → 回调 URL 与 `WECHAT_PAY_NOTIFY_URL` 一致。

## 本地私钥放哪

```text
book-mall/certs/apiclient_key.pem   # 商户私钥（.gitignore，勿提交）
book-mall/certs/wechat_pay_pub_key.pem  # 公钥（已在仓库，镜像自带）
```

从微信商户平台 → API 安全 → 下载证书包解压得到。
