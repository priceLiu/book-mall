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
