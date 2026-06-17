# Gateway Models Market · 发布计划

> 版本：2026-06-16 · 范围：book-mall 后端 + gateway-web 控制台

## 1. 功能摘要

| 模块 | 说明 |
|------|------|
| **模型市场列表** | `/dashboard/market` · 精选轮播、厂商/任务筛选、搜索、模型卡片 |
| **Playground** | `/dashboard/market/{canonicalKey}` · Form/JSON、Run、轮询、输出预览 |
| **Examples / README** | 表单 schema 示例 + `gateway-market-presentation.json` 文案 |
| **Your runs** | 每模型最近 8 条成功记录（`clientPage=market-playground/{key}`） |
| **权限** | **所有已登录 Gateway 用户**可见「日志」「模型市场」；BYOK/平台池_delegate 仍保留模型管理、密钥、API 调试、文档 |

## 2. 依赖与前置

### 2.1 数据库 / Registry（已在本地执行）

```bash
cd book-mall
pnpm gateway:seed-registry --confirm
pnpm exec dotenv -e .env.local -- tsx scripts/seed-platform-model-costs.ts
```

- Registry：61 条 canonical 模型
- Platform offerings：27 条 ACTIVE（有定价且 `activeModelKey` 非空）

### 2.2 环境变量（无新增）

沿用现有：

- `book-mall`：`GATEWAY_JWT_SECRET`、OSS、Platform 代付 Key
- `gateway-web`：`BOOK_MALL_ORIGIN`（或等价主站 origin 配置）

### 2.3 Book 侧

- 用户须 **关联 Gateway API Key**（`User.gatewayApiKeyId`）方可 Playground Run
- 平台代付：走平台池 sk-gw + 积分扣费
- BYOK：展示已绑定厂商凭证下的模型目录

## 3. 部署顺序

1. **book-mall**（含新 API + market lib + presentation JSON）
2. **gateway-web**（导航 + Market UI）
3. 生产环境重复执行 **§2.1** 两条 seed（若 registry / 定价尚未同步）

### API 清单（book-mall）

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/gateway/market/models` | 列表 + featured + filters |
| GET | `/api/gateway/market/models/{...canonicalKey}` | 详情 + playground schema |
| GET | `/api/gateway/market/history?canonicalKey=` | 8 条历史 |
| POST | `/api/gateway/market/jobs` | 创建任务 |
| GET | `/api/gateway/market/jobs?taskId=` | 轮询 |
| POST | `/api/gateway/market/upload` | data URL → OSS |

gateway-web 经现有 BFF：`/api/book-mall/api/gateway/market/*`

## 4. 验收清单

### 4.1 导航与权限

- [ ] 平台代付用户：侧栏含 **用量、日志、模型市场**（无模型管理/密钥）
- [ ] BYOK / 平台池 delegate：侧栏含完整项 + 模型市场
- [ ] 未登录访问 `/dashboard/market` → 跳转登录

### 4.2 列表页

- [ ] Featured 轮播可点击进 Playground
- [ ] Provider / Task 筛选与搜索生效
- [ ] 平台代付仅见已上架且有积分定价的模型

### 4.3 Playground

- [ ] Grok T2I / I2V、gpt-image-2、wan v2v、Kling motion、Topaz upscale 可 Run
- [ ] 图片/视频字段支持 URL 或本地上传（OSS）
- [ ] 成功后 Output 预览 + Your runs 8 格更新
- [ ] Chat 类模型（如 deepseek-chat）返回文本
- [ ] 失败有可读 error；日志页可见 `clientPage=market-playground/...`

### 4.4 回归

- [ ] 原 `/dashboard/logs` 仍正常
- [ ] BYOK `/dashboard/playground`（sk-gw 直调）不受影响
- [ ] Gateway v1 CreateTask / RecordInfo 其它客户端无回归

## 5. 监控与回滚

- **监控**：`GatewayRequestLog` 中 `clientSource=GATEWAY_CONSOLE` 且 `clientPage` 前缀 `market-playground/` 的成功率与积分扣费
- **回滚**：仅回滚 gateway-web 可隐藏 UI；book-mall API 为 additive，可不回滚

## 6. 已知限制 / 后续

- Playground 显式 schema 覆盖 KIE 重点模型；其余模型为通用 prompt 或 chat fallback
- 平台 offering 未定价模型不会出现在平台代付用户市场列表
- Canvas / tool-web 侧 v2v/motion/topaz 实验室入口可单独迭代
- `gateway-market-presentation.json` 封面/hero 可按运营更新，无需发版 schema

## 7. 变更文件索引

**book-mall**

- `config/gateway-market-presentation.json`
- `lib/gateway/market-catalog.ts`
- `lib/gateway/market-playground-schemas.ts`
- `lib/gateway/market-playground-service.ts`
- `lib/gateway/gateway-billing-persona.ts`
- `app/api/gateway/market/**`

**gateway-web**

- `app/dashboard/market/**`
- `app/dashboard/layout.tsx`
- `components/market/**`
- `lib/market-types.ts`
