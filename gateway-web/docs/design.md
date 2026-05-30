# Gateway 控制台 · 设计规范

gateway-web 深色控制台 UI 约定。实现时以 **CSS 变量 + `globals.css` 组件类** 为真源；改尺寸须同步更新本文。

相关：`app/globals.css` · `components/logs/*` · `lib/gateway-log-display.ts`

---

## 1. 色板与基础

| Token | 值 | 用途 |
|-------|-----|------|
| `--gw-bg` | `#0c0c0f` | 页面背景 |
| `--gw-surface` | `#141419` | 卡片 / 侧栏 |
| `--gw-ink` | `#f4f4f5` | 主文字 |
| `--gw-muted` | `#a1a1aa` | 次要文字 |
| `--gw-accent` | `#fb923c` | 主按钮 / 强调 |

日志表背景 `#0f0f14`，行 hover `bg-white/[0.03]`。

---

## 2. 日志表（Logs）

真源：`components/logs/logs-table.tsx` · `globals.css` `.gw-logs-table`

| 列 | 说明 |
|----|------|
| ☑ | 多选 |
| Model | 蓝 pill 模型名 → 时间戳 → `Duration: N` |
| Params | 缩略卡片 + 悬停 Tip（§3） |
| Status | 圆点 + 小写英文；running/pending 带深灰 pill |
| Usage | **用量观测**（非钱包扣点）：LLM 多为 **`4626 tok`**（悬停可看输入/输出）；少数行有挂牌参考 **元**（B 表估算，非平台计费）。进行中显示 `—` |
| Task ID | 完整 monospace |
| Results | Result 按钮 + 复制 + 悬停预览（§3） |
| Retry Callback | 暂无则 `—` |

### Status 圆点颜色（inline style，勿依赖 Tailwind 动态 class）

| 状态 | 颜色 |
|------|------|
| success | `#22c55e` |
| running | `#f97316` |
| pending | `#eab308` |
| failed | `#ef4444` |

---

## 3. 悬停 Tip（Params / Result）

真源：`globals.css` · `components/logs/log-params-cell.tsx` · `log-result-cell.tsx`

### 3.1 尺寸（CSS 变量）

| 变量 | 值 | 说明 |
|------|-----|------|
| `--gw-log-tip-width` | **720px** | Params Tip 宽度上限（高度不变，仅加宽） |
| `--gw-log-tip-max-h` | **680px** | Tip 外框最大高度（较旧版 480px 加高） |
| `--gw-log-tip-body-max-h` | **580px** | 可滚动内容区最大高度 |

Result 预览宽度 **420px**，复用同一套高度与滚动条规则。

### 3.2 布局

```text
┌─ .gw-log-preview-tip ─────────────────┐
│  .gw-log-preview-tip__body (滚动)      │
│    input:                             │
│    { ... 格式化 JSON ... }            │
│                                       │
│    model: xxx                         │
├─ .gw-log-preview-tip__footer ────────┤
│  [复制图标]                            │
└───────────────────────────────────────┘
```

- **交互**：鼠标可移入 Tip；离开单元格 / Tip 后 **280ms** 延迟关闭
- **Params 单元格**：单行 `input: {...}` 缩略 + `model:` 行 + 左下复制
- **Tip 复制**：footer 左下角仅图标按钮

### 3.3 细滚动条（`.gw-scrollbar-thin`）

**必须**用于所有日志 Tip 内容区，禁止粗默认滚动条。

| 属性 | 值 |
|------|-----|
| Firefox | `scrollbar-width: thin` |
| WebKit 宽度 | **4px** |
| 滑块 | `rgba(255,255,255,0.22)`，圆角 pill |
| 滑块 hover | `rgba(255,255,255,0.34)` |
| 轨道 | transparent |

用法：

```html
<div class="gw-log-preview-tip__body">...</div>
```

### 3.4 Params 复制文本格式

```text
input:
{ ... pretty JSON ... }

model: model-name
```

---

## 4. Tailwind 扫描

`tailwind.config.ts` 须包含 `./lib/**`，避免 `lib/` 内展示类被 purge。

---

## 5. 变更检查清单

- [ ] Tip 高度仍用 CSS 变量，未写死 480/400
- [ ] 新滚动区域使用 `.gw-scrollbar-thin`
- [ ] Status 圆点用 inline `backgroundColor`
- [ ] 改常量后更新本文 §3.1 表格

---

## 6. 模型管理（Model Manager）

真源：`components/model-manager/*` · `/dashboard/models` · `book-mall/app/api/gateway/credentials/*`

交互参考上游 prompt-optimizer Model Manager；**视觉沿用 Gateway 色板**（§1），不引入 Naive UI。

### 6.1 页面结构

```text
┌─ Tab: Text Models | Image Models | Function Models ─────────┐
├─ 厂商卡片 ────────────────────────────────────────────────────┤
│  DeepSeek                    [Disabled]                     │
│  [DeepSeek] [DeepSeek V4 Flash] [Tool Calling] [Reasoning]    │
│                    Test · Edit · Clone · Enable/Disable     │
└───────────────────────────────────────────────────────────────┘
```

| Tab | catalog `requestKind` |
|-----|------------------------|
| Text Models | `CHAT` |
| Image Models | `IMAGE` |
| Function Models | `OTHER`、`TTS`、`VIDEO`、`TRYON`（或带 tool 能力 tag） |

### 6.2 厂商卡片

| 元素 | 类 / 约定 |
|------|-----------|
| 卡片容器 | `.gw-card` · `border-white/10` · `bg-white/[0.02]` |
| 厂商名 | `text-lg font-semibold text-white` |
| Disabled 徽章 | `text-amber-400/90` · 小 pill · 无 active 凭证或未 Enable |
| 模型 tag | 蓝 pill：模型 displayName；灰：providerKind |
| 能力 tag | 绿：`Tool Calling`；棕：`Reasoning`；红：`CORS Restricted`（若适用） |
| 行操作 | 文字链 + 图标；Disable 用 `--gw-accent` 或 amber |

### 6.3 编辑弹窗（Edit）

| 字段 | 说明 |
|------|------|
| Display Name | 凭证 alias |
| Enable Status | checkbox → `active` |
| Provider | pill 选择 `GatewayProviderKind` |
| API Key | password；编辑时空则不改 |
| API URL | 可选 baseUrl |
| Select model | 下拉 + 刷新（catalog）；只读展示默认模型可选 |
| Advanced Parameters | 折叠区；首版可占位 |

弹窗：`.gw-card` 居中 · 遮罩 `bg-black/70` · 主按钮 `--gw-accent` · Cancel ghost。

### 6.4 操作

| 操作 | API |
|------|-----|
| Test Connection | `POST /api/gateway/credentials/test` |
| Edit | `PATCH /api/gateway/credentials` |
| Clone | `POST /api/gateway/credentials/clone` |
| Enable / Disable | `PATCH` `{ active: true/false }` |
| Delete | `DELETE` + **二次确认 Modal**（禁止 `window.confirm`） |

### 6.5 导航

- 侧栏：**模型管理** → `/dashboard/models`
- 原 **厂商凭证** `/dashboard/credentials` → 重定向至 `/dashboard/models`

### 6.6 变更检查清单

- [ ] Tab 切换不丢筛选状态
- [ ] 未绑凭证的 provider 显示 Disabled + Edit 引导
- [ ] 删除凭证二次确认 Modal
- [ ] 改交互后更新本文 §6
