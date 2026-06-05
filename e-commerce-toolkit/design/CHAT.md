# 电商工具箱 · 创作助手 / 聊天窗口

> 母规范：`SYSTEM.md` §5.4、§6。首版实现：微剧故事版 `StoryboardAssistantPanel`。

## 布局结构

```
┌─ 顶栏（标题 + 模型名 + 设置图标按钮）─────────┐
├─ StoryboardTaskStatus（流式时）──────────────┤
├─ 消息列表（scroll, ecom-scrollbar-thin）─────┤
│    用户气泡（右） / 助手气泡（左）              │
│    └─ 最后一条助手消息内：Choice Chips        │
├─ 输入区（border-t）──────────────────────────┤
│    textarea + [发送 Primary] [清空 Secondary] │
└────────────────────────────────────────────┘
```

- 助手栏背景：`bg-[#fafafa]`
- 消息区内边距：`px-4 py-4 space-y-3`

## 消息气泡

### 用户

```tsx
"max-w-[95%] ml-auto rounded-2xl border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-2 text-sm leading-relaxed text-[#1d1d1f]"
```

### 助手

```tsx
"max-w-[95%] rounded-2xl bg-white px-3 py-2 text-sm leading-relaxed text-[#1d1d1f] shadow-sm ring-1 ring-[#e8e8ed]"
```

- 正文用 `whitespace-pre-wrap font-sans`，保留 Markdown/表格换行
- 机器可读块（`storyboard-deliverable`）在展示层 strip，气泡可保留全文或展示层过滤（实现约定即可）

## 快捷选择按钮（Choice Chip）

**唯一权威 class**：`STORYBOARD_ASSISTANT_CHOICE_CLASS`（`storyboard-assistant-choices.tsx`）

```tsx
"rounded-full border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-1.5 text-xs font-medium text-[#1d1d1f] transition-colors hover:border-[#86868b] hover:bg-[#ebebed] disabled:opacity-50"
```

### 区块结构

```tsx
<div className="mt-3 border-t border-[#e8e8ed] pt-3">
  <p className="mb-2 text-[11px] text-[#6e6e73]">请选择（无需输入）：</p>
  <div className="flex flex-wrap gap-2">{/* chips */}</div>
</div>
```

策划首轮文案可为「请选择策划方式（无需输入）：」。

### 交互规则

| 规则 | 说明 |
|------|------|
| 仅一条 | 只在 **最后一条助手消息** 底部渲染，禁止输入区上方重复 |
| 统一样式 | 所有选项同一套 Chip，**禁止**深色主按钮区分「默认方案」 |
| 禁用 | 流式输出中 `disabled`，不响应点击 |
| 特殊动作 | 「生成全部分镜图」打开右侧模型选择，不发聊天消息；「重新定方案」清 sheet 后发「自定义参数」 |

## 输入区

### Textarea

```tsx
"mb-3 w-full resize-none rounded-xl border border-[#d2d2d7] bg-white px-3 py-2 text-sm outline-none focus:border-[#0071e3]"
```

- `rows={2}`，placeholder 简短说明可选输入
- `Enter` 发送，`Shift+Enter` 换行
- 流式中 `disabled`

### 底栏按钮

| 按钮 | 组件 | 说明 |
|------|------|------|
| 发送 | `EcomButtonPrimary size="sm" className="flex-1"` | 无内容时 disabled；流式中显示 `Loader2` |
| 清空 | `EcomButtonSecondary size="sm"` | 重置为欢迎语，非 destructive 红 |

**禁止**在输入区再放一套 `inferAssistantChoices`。

## 顶栏工具

设置等图标按钮：

```tsx
"flex h-9 w-9 items-center justify-center rounded-lg border border-[#d2d2d7] bg-white text-[#6e6e73] hover:border-[#0071e3] hover:text-[#0071e3]"
```

## 流式与任务反馈

- 助手栏：`StoryboardTaskStatus` — title「思考中」，detail 说明流式行为
- 内容区：可选横幅 `bg-[#0071e3]/10` + `Loader2`「助手正在流式输出…」
- 完成后 `onDeliverableReady` 刷新右侧结构化结果

## 新模块接入 checklist

- [ ] 使用 `EcomWorkspaceLayout` 左栏 ~30%
- [ ] 气泡样式与用户/助手 class 与上表一致
- [ ] 快捷选项走 Choice Chip，逻辑独立函数（如 `inferAssistantChoices`）
- [ ] 发送/清空走 `EcomButtonPrimary` / `EcomButtonSecondary`
- [ ] 无 `window.alert`；错误用 `useDialogs().alert`
