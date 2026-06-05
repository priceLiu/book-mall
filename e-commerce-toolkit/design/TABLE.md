# 电商工具箱 · 表格与字段展示

> 母规范：`SYSTEM.md` §7。

## 模式 A · 数据表（分镜脚本、交付表格）

用于列较多、需横向滚动的结构化数据。

### 外壳

```tsx
<div className="overflow-x-auto rounded-lg border border-[#e8e8ed]">
  <table className="w-full min-w-[720px] border-collapse text-left text-xs">
```

### 表头

```tsx
<tr className="bg-[#1d1d1f] text-white">
  <th className="px-3 py-2 font-medium">列名</th>
</tr>
```

- 背景 **墨黑** `#1d1d1f`，文字白，**不用**品牌蓝表头
- 字号 `text-xs`，字重 `font-medium`

### 表体

```tsx
<tr className="border-t border-[#e8e8ed] align-top">
  <td className="px-3 py-2">…</td>
</tr>
```

- **必须** `align-top`：多行「画面内容」时各列顶对齐
- 镜号列可加 `font-medium`
- 时间轴等次要列可用 `text-[#6e6e73]`
- 空单元格显示 `--`

### 行内操作

表格内「修改」等用 **工具条按钮**（`rounded-lg`，见 `SYSTEM.md` §5.3），勿用主胶囊。

```tsx
"inline-flex items-center gap-1 rounded-md border border-[#d2d2d7] px-2 py-1 text-[11px] text-[#1d1d1f] hover:border-[#0071e3] hover:text-[#0071e3]"
```

## 模式 B · 字段行（策划定稿、键值展示）

用于步骤结果、方案摘要。

### 区块

```tsx
<section className="rounded-xl border border-[#e8e8ed] bg-white p-5">
  <h2 className="mb-4 text-lg font-semibold text-[#1d1d1f]">区块标题</h2>
```

### 单行字段

```tsx
<div className="grid gap-1 border-b border-[#f0f0f2] py-2.5 sm:grid-cols-[7rem_1fr] sm:gap-4">
  <span className="text-xs font-medium text-[#6e6e73]">标签</span>
  <div className="min-w-0 text-sm text-[#1d1d1f]">值</div>
</div>
```

- 标签列固定约 `7rem`，值列 `min-w-0` 防溢出
- 缺失值：`<span className="text-sm text-[#86868b]">--</span>`

### 嵌套 Markdown 表

助手交付的 Markdown 表格走 `StoryboardMarkdownBlock`；若需与模式 A 一致，在 block 内复用深色表头 token（后续统一）。

## 模式 C · 印刷/导出表（例外）

`StoryboardProSheetView` 等 **导出 PNG / html2canvas** 场景使用内联 `border: 2px solid #1d1d1f` 印刷风格，**不**强制 Tailwind 模式 A，但列语义须与模式 A 一致（时间轴、景别、画面内容…）。

## 禁止

- 表头用品牌蓝或渐变
- 单元格 `vertical-align: middle` 导致多行内容列错位
- 在表内用 `EcomButtonPrimary` 占满行高
