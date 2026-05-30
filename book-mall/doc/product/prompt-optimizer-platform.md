# 提示词优化器 · 平台接入产品说明

> **状态**：实施中  
> **实施计划**：[../plans/2026-prompt-optimizer-platform-rollout.md](../plans/2026-prompt-optimizer-platform-rollout.md)  
> **上游**：[linshenkx/prompt-optimizer](https://github.com/linshenkx/prompt-optimizer)（AGPL-3.0）

---

## 1. 定位

独立工具应用 **prompt-optimizer-platform**（`:3006`），提供 AI 提示词编写、优化、对比与测试。UI 与交互 **沿用上游原项目**（Vue + Naive UI），不重写为 Next 业务页。

Book 负责：身份、工具套件准入、钱包与月费；Gateway 负责：厂商 Key 与模型路由；子应用负责：提示词工作流与会话。

---

## 2. 用户流程

```text
Book 注册 / 登录
  → 钱包充值（可选）
  → 订阅中心 · 开通「提示词优化器」工具月费
  → 个人中心 · 关联 Gateway API Key（sk-gw-...）
  → Gateway · 模型管理 · 绑定厂商凭证（DeepSeek / 百炼 / …）
  → 打开 prompt-optimizer（:3006 或生产域名）
  → 编写 / 优化提示词（经 Gateway 调用模型）
```

与 Canvas 相同：**月费在 Book 扣钱包**；**云厂商推理费用由用户 Gateway BYOK 自担**。

---

## 3. 平台约束

| 约束 | 说明 |
|------|------|
| 禁止直连厂商 | 浏览器与子应用均不得 `fetch` OpenAI / DashScope 等域名 |
| Key 只在 Gateway | 子应用不提供 API Key 配置；upstream Model Manager 写 Key 能力在平台版关闭 |
| Book SSO | `tools_token` + introspect；禁止 Cookie 透传作为唯一鉴权 |
| navKey | `prompt-optimizer` |

---

## 4. 计费

见 [13-tool-service-fee-and-wallet.md](./13-tool-service-fee-and-wallet.md)：

- **工具月费**：`ToolServiceFeePlan.toolNavKey = prompt-optimizer`（首版占位与 AI 海报画布同级，产品后可调）
- **不按次扣点**：生成时不从 Book 钱包按 Token 扣点
- **Gateway 用量**：用户在 Gateway 控制台查看预估厂商成本

---

## 5. 与 Gateway 模型管理的关系

上游自带 Model Manager（厂商 pill、Test Connection、Enable/Disable）。**平台版**：

- **Gateway** 提供统一的模型管理 UI（见 gateway-web § Model Manager）
- **prompt-optimizer** 仅消费已启用模型列表；未配置时引导至 Gateway

---

## 6. 环境变量

| 位置 | 变量 |
|------|------|
| book-mall | `TOOLS_PUBLIC_ORIGIN` 含 prompt 子站；SSO 密钥 |
| prompt-optimizer-platform | `MAIN_SITE_ORIGIN`、`TOOLS_SSO_*`、`PROMPT_OPTIMIZER_PUBLIC_ORIGIN`（可选） |
| gateway-web | `BOOK_MALL_ORIGIN`、`GATEWAY_PUBLIC_ORIGIN` |

---

## 7. 部署

- 独立 CloudBase 服务，目标目录 `prompt-optimizer-platform`（与 canvas-web 相同 Monorepo 子目录模式）
- 容器监听 **3006**（外网 80 映射至 3006）
- 构建：`Dockerfile` 多阶段（`prompt-optimizer/` vendor → Next `standalone`），**git push 自动构建**，无需提交 `public/` 产物

---

## 8. 开源合规

上游 **AGPL-3.0**。若对外提供 SaaS，须在服务中说明如何获取对应源代码（monorepo 公开或提供链接）。
