# 独立工具站与黄金会员（〇八）

## 文档目的

约定 **主站与独立部署 AI 工具** 之间的准入规则（**黄金会员**）与集成边界，避免与站内「订阅 + 余额」的高级计量权益混淆。

## 黄金会员（工具站）

须 **同时** 满足：

1. 用户钱包存在至少一条 **`RECHARGE`** 流水（历史上完成过充值入账）；  
2. 当前 **`Wallet.balanceMinor` ≥ `PlatformConfig.minBalanceLineMinor`**（默认 **¥20**）。

代码：`lib/gold-member.ts`。

## 与「高级计量会员」的区别

| 名称 | 条件（摘要） | 典型用途 |
|------|----------------|----------|
| **高级计量会员** | 订阅有效 **且** 余额 ≥ 最低线 | 主站内高阶内容 / 按量工具（`getMembershipFlags().canUsePremiumMetered`） |
| **黄金会员** | 有充值记录 **且** 余额 ≥ 最低线 | **独立工具站** SSO 准入（试衣间等） |

二者 **无包含关系**：仅有订阅无充值流水不算黄金会员；满足黄金会员也未必已订阅。

## 集成与安全

SSO 采用 **一次性授权码 + 短时 JWT**；工具站 **服务端** 换票；敏感操作前可调 **`GET /api/sso/tools/introspect`**。

详见：

- 完整需求与占位域名：[`../v1.1`](../v1.1)  
- 环境变量与接口清单：[`../tech/tools-sso-environment.md`](../tech/tools-sso-environment.md)  
- 时序与失败分支：[`../logic/tools-sso-session.md`](../logic/tools-sso-session.md)
