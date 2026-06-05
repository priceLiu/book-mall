# 电商工具箱（e-commerce-toolkit）

> **设计**：monorepo `e-commerce-toolkit/design/DESIGN.md`  
> **价目 B 层**：`e-commerce-toolkit/doc/price-baseline.md`  
> **联邦约束**：[12-platform-app-federation.md](./12-platform-app-federation.md)

## 1. 产品定位

面向电商卖家的 **全屏 AI 工具箱**：主图、详情、模特图、带货视频、**微剧情分镜故事版**、IP/海报/VI、宣传片与广告短片。独立域名部署，账号经 Book SSO 互通。

### 微剧情分镜（M5）

- 入口：`/ecom/storyboard/micro-drama`
- 左栏创作助手（DeepSeek / Gemini，Gateway 流式）+ 可选多参考图
- 右栏可变镜数 HTML 分镜表；可导出 HTML / PNG（PNG 作为视频模型主参考图）
- 整片视频：`doubao-seedance-2.0`，时长 4–15s 用户自定，全部经 Gateway
- toolKey：`ecom-toolkit__storyboard`（`chat` / `video`）

## 2. 计费双轨（readme §6）

用户在 **个人中心 · 电商工具箱计费** 选择模式（默认 **BYOK 月费**，降低平台垫资）：

| 模式 | 用户感知 | Gateway | 钱包 |
|------|---------|---------|------|
| **6a PLATFORM_METERED** | 充值 → 按张/秒扣点 | 平台 PLATFORM sk-gw（`ECOM_PLATFORM_GATEWAY_API_KEY_ID`） | reserve / settle |
| **6b BYOK_SERVICE_FEE** | 开通月费 → 云账单自担 | 用户 Personal sk-gw | 仅月费；usage 不扣点 |

**与 Phase D 关系**：tool/canvas 等仍「月费 + BYOK」。仅 `ecom-toolkit__*` 在 6a 下走 Scheme A；非全站回退。

### 切换规则

- 无 `WalletHold(HELD)`、无 RUNNING 生成任务时可切换。
- 6a → 6b：须已开通 `e-commerce-toolkit` 月费并关联 Gateway。
- 6b → 6a：须钱包余额满足预估。

## 3. 准入

| 模式 | 条件 |
|------|------|
| 6a | 钱包余额 + 水位线（可选）；**不要求**月费 |
| 6b | 有效 `UserToolServicePeriod`（navKey `e-commerce-toolkit`）+ Gateway 已关联 |

管理员 SSO 直通。

## 4. 技术

- SSO：`app=e-commerce`
- navKey：`e-commerce-toolkit`
- Gateway 日志：`clientSource=E_COMMERCE`，`clientPage=ecom/{userId}/{workspaceId}/{toolKey}`
- 子应用端口：3007；生产 `ecom.ai-code8.com`

## 5. 月费（6b）

`ToolServiceFeePlan.toolNavKey = e-commerce-toolkit`，首期建议 **4000 点/30 天**（可后台调整）。
