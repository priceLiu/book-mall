# 工具站 UI 壳层约定：关闭按钮、提醒色、计费提示

本文约定 **弹层 / 灯箱右上角 ×**、**正向计费提醒（薄荷绿）**、**重新连接** 的统一实现，避免各页各自写样式。

## 统一关闭按钮（×）

- **组件**：`components/ui/tool-shell-close-button.tsx`（`ToolShellCloseButton`）。
- **视觉**：圆形、黑底 `#0a0a0a`、hover `#27272a`、glyph「×」，尺寸与 hover 行为见 `app/globals.css` 中的 `.tool-close-btn`。
- **用法**：
  - 普通弹层头部右侧：`<ToolShellCloseButton label="关闭" onClick={…} />`（`label` 作 `aria-label`，勿省略）。
  - 叠放在大图角落（衣柜灯箱、图片库灯箱、试衣间预览弹层等）：加 **`floating`**，父级需 **`position: relative`**，以便绝对定位到右上角。

不要在业务模块里再手写 `.closeBtn` / `.modalClose` / `.lightboxClose` 等重复样式。

## 提醒色（计费成功 / 正向说明）

- **语义**：生成成功后的扣费口径说明、会话已就绪的温和提示等（**不是**错误态）。
- **令牌**：`app/globals.css` 中 `--tool-reminder-success-*`。
- **样式类**：
  - **条 / 胶囊**：`.tool-reminder-banner`；占满一行时用 `.tool-reminder-banner--block`（圆角矩形）。
  - **需注意（未就绪、余额等）**：`.tool-reminder-warn`（琥珀底）。
  - **错误 / 阻断**：`.tool-reminder-danger`（浅红底）；尽量少用，与正向提醒区分清楚。

文生图 settle 成功文案应与 AI 试衣结果区的计费提示 **同一视觉体系**（薄荷绿条），具体文案可按产品细化，但 **不要在成功路径上用红色块**。

## 「重新连接」

- **样式**：`.tool-renew`（薄荷绿药丸，与正向提醒同一色系）；顶栏紧凑文字链可用 `.tool-renew--compact`。
- **位置**：主会话 UI 由 `ToolShellClient` 顶栏承载；各工具页内若单独提供重新登录入口，也应挂 `.tool-renew*`，避免再用醒目红色按钮。

## 计费提示规则（生成后必显）

对 **会产生计费的成功生成**（文生图、AI 试衣成片等）：

1. 在用户能看到 **生成结果** 的同一界面，展示至少一条 **正向提醒条**（`.tool-reminder-banner` 系），说明扣费口径与 **费用明细 / 使用明细** 查询位置。
2. 失败、超时、未登录等路径不得冒充「已成功计费」；成功但未扣费（幂等命中等）可用文案区分（参见文生图 modal 逻辑）。
3. 新增同类计费工具时：复用上述组件与 CSS，并在 `doc/product/` 或计费文档中补齐单价与事件类型。

## 相关代码索引

- 全局样式：`app/globals.css`（`.tool-close-btn*`、`.tool-reminder-*`、`.tool-renew*`）。
- Cursor 规则：`tool-web/.cursor/rules/tool-web-ui-shell.mdc`。
