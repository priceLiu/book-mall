# 快速复制 · 生成前积分预览

> **状态**：已实施（2026-08）  
> **关联**：实扣经 `qr-generate-service` → `finalizeRequestLog`；计价与 [21-unified-credit-formula-v2](21-unified-credit-formula-v2.md) 单池 v2 一致。  
> **平台文档**：[quick-replica-platform.md](quick-replica-platform.md)

---

## 1. 背景与范围

- **实扣已存在**：快速复制生成任务在 book-mall 侧经 Gateway 日志结算，与 Canvas / 工具站共用 `previewModelCredits` / 统一扣分公式。
- **缺口**：`quick-replica-web` 无余额展示、无「产生」前的预估扣分；draft 多分支（音频 / 世界 / KIE 通用 / 运动同步等）不宜在前端复制路由逻辑。
- **联邦约束**：计价与余额只在 book-mall（Single Writer）；子站经 BFF 调用 Platform API，禁止直连 PostgreSQL 或复制计费规则。

**本期范围**：所有已接入 `qrCreateGenerateJob` 的 workspace「产生」入口展示预估；余额不足时点击产生再提示（不禁用钮）。

**非目标（P2）**：顶栏全局余额 Chip；语音克隆分项明细 UI（后端可返回 `items`，前端首期仅展示合计）。

---

## 2. 用户故事

| 场景 | 期望 |
|------|------|
| 换模型 / 改时长 / 改分辨率 | 「约 N 积分」随 draft 字段实时更新 |
| 平台代付余额不足 | `sufficient: false`，点击产生时提示具体差额 |
| BYOK 账号 | 产品已下线；快速复制仅平台代付积分预览 |

---

## 3. 覆盖能力（与 `qrCreateGenerateJob` 对齐）

| 分支 | 预览输入 |
|------|----------|
| `motion-sync` | `modelKey`，`durationSec` ← `draft.duration` 或默认 15s |
| `text-to-video` | `modelKey`，`durationSec`，`resolution` |
| `create-image` / 角色图 kind | `modelKey`，`imageCount=1`，`resolution` |
| 音频 kind（旁白 / 音乐 / SFX / 变声 / 克隆） | 各子服务 `modelKey` + 音频时长（如 `sfxDurationSeconds` / `musicDurationSeconds`） |
| `create-world` | `resolveWorldlabsMarbleModelKey(draft)` |
| 其余 video / image（KIE 通用） | `modelKey`，`durationSec` / `imageCount` |

---

## 4. API 契约

**路径**：`POST /api/platform/v1/quick-replica/credits-preview`  
**鉴权**：与 `jobs/generate` 相同 — `requireQuickReplicaUser`（Gateway Key + `navKey: quick-replica`）。  
**请求体**：与 generate 相同，`parseQrWorkspaceDraft(body)`。  
**子站 BFF**：`POST /api/book-mall/api/platform/v1/quick-replica/credits-preview`

**响应示例（平台代付）**：

```json
{
  "billingPersona": "PLATFORM_CREDIT",
  "estimatedCredits": 525,
  "items": [{ "label": "文生视频", "modelKey": "kling/v3-turbo-text-to-video", "credits": 525 }],
  "balance": 1200,
  "reserved": 0,
  "sufficient": true,
  "label": "约 525 积分"
}
```

**响应示例（BYOK 存量账号已下线，API 恒为 `PLATFORM_CREDIT`）**：

与上例相同；不再返回「套餐内 / 厂商自付」等 BYOK 文案。

**无法估算**：`estimatedCredits: null`，`sufficient: false`，`label: "暂无报价"`，`reason` 说明（如模型未登记）。

**错误**：`400` 无效 draft；`401/403` 鉴权与准入（与 generate 一致）。

---

## 5. UI 规范

- 位置：**产生 / 生成** 钮旁或上方，次要文字（不抢 `qr-btn-primary` 视觉权重）。
- 平台代付：`约 {N} 积分`（参考 Canvas `≈ N积分` 密度，适配 QR 深色主题）。
- 加载：`估算中…`；失败 / 无报价：muted 文案。
- 余额不足：点击时错误提示（不禁用产生钮）；`handleGenerate` 仍保留后端 402 兜底。

实现：`quick-replica-web/components/quick-replica/qr-credits-hint.tsx` + `hooks/use-qr-credits-preview.ts`。

---

## 6. 与实扣差异

| 项 | 预览 | 实扣 |
|----|------|------|
| 文案 | 「约」 | 结算后实际扣分 |
| TTS / 音乐 | 按 draft 时长或默认秒数估算 | 实际输出秒数可能不同 |
| 未登记模型 | `estimatedCredits: null` | 生成可能失败或走 Gateway 兜底 |

---

## 7. 验收清单

### 自动化

- `pnpm exec vitest run book-mall/test/unit/qr-credits-preview.test.ts`

### 手工

- [ ] 文生图换模型，积分变化
- [ ] 文生视频改时长，积分变化
- [ ] 余额不足时点击产生有提示、钮仍可点
- [ ] 世界生成钮旁有 hint
- [ ] 音频 workspace 产生钮旁有 hint
- [ ] generate 实扣路径未改动，扣费仍正常

---

## 8. 部署

仅需发布：

- **book-mall**（`lib/quick-replica/qr-credits-preview.ts` + API 路由）
- **quick-replica-web**（hook + `QrCreditsHint`）

无数据库迁移。模型须在 `ModelCreditPrice` 登记，否则预览返回无法估算。
