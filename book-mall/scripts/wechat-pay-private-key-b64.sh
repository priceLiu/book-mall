#!/usr/bin/env sh
# 将微信商户私钥转为 CloudBase 环境变量 WECHAT_PAY_PRIVATE_KEY_B64（单行 base64）
# 用法：./scripts/wechat-pay-private-key-b64.sh /path/to/apiclient_key.pem
set -e
file="${1:-certs/apiclient_key.pem}"
if [ ! -f "$file" ]; then
  echo "文件不存在: $file" >&2
  exit 1
fi
echo "复制以下整行到 CloudBase book-mall → WECHAT_PAY_PRIVATE_KEY_B64："
base64 < "$file" | tr -d '\n'
echo ""
