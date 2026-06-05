# 电商工具箱 · 布局与壳层

> 母规范：`SYSTEM.md` §4。

## 层级

```
EcomAppShell（全屏）
├── EcomProfileSidebar（左导航，深色，可折叠）
└── 主工作区（rounded-xl, parchment 底）
    ├── EcomMobileBar / EcomAuthBanner
    └── 页面内容
        └── EcomWorkspaceLayout（可选双栏）
            ├── aside 助手 ~30%
            ├── progress 进度轨（可选）
            └── main 内容 ~70%
```

## EcomAppShell

| 属性 | 值 |
|------|-----|
| 外底 | `bg-[#0c0c0e]`，`p-3 md:p-5`，`h-dvh` |
| 内工作区 | `rounded-xl bg-[var(--ecom-parchment)] shadow-inner` |
| 侧栏 | `EcomProfileSidebar`，`md:flex`，深色 tile |

## EcomWorkspaceLayout

| 区域 | 宽度 / 样式 |
|------|-------------|
| 助手 `aside` | `w-[30%] min-w-[260px] max-w-[400px]`，`border-r border-[#e8e8ed]`，`bg-[#fafafa]` |
| 助手头 | `assistantHeader`，`border-b`，`px-4 py-3` |
| 进度轨 | `progress`，窄竖条，夹在助手与内容之间 |
| 主内容 `main` | `flex-1`，`bg-[#f5f5f7]`，`min-h-0 overflow-hidden` |

`fullWidth` 时省略助手，内容占满。

## 页面标题区（助手头 / 内容顶）

```tsx
<h1 className="text-lg font-semibold text-[#1d1d1f]">模块名</h1>
<p className="text-xs text-[#6e6e73]">副标题 / 场景说明</p>
```

右上操作：`EcomButtonSecondary size="sm"`（如「新建微剧故事版」）。

## 内容区滚动

```tsx
<div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto p-6">
```

任务条、导出条可在滚动区外固定或 `mx-6` 贴顶。

## StepSection（右侧步骤卡片）

```tsx
<section className="rounded-xl border border-[#e8e8ed] bg-white p-5">
  <h2 className="mb-4 text-lg font-semibold text-[#1d1d1f]">步骤名</h2>
  …
</section>
```

多个 Step 纵向 `space-y-6`。

## 进度轨 StoryboardProgressRail

- 竖向步骤点 + 标签
- 完成：绿勾；跳过：减号；进行中：蓝强调；待办：灰

新长流程工具可复用此轨模式或简化为顶栏 stepper，色票与 `SYSTEM.md` §10 一致。

## 响应式

- 侧栏：移动端 `EcomMobileBar` 代替固定侧栏
- 表格：`overflow-x-auto` + `min-w-[720px]`
- 双栏：小屏可考虑叠放（待产品定 breakpoint；当前以桌面工作台为主）
