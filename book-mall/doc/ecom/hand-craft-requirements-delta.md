# 手办创作 · 增量需求（2026-10）

- **入口不变**：`/ecom/hand-craft`，module id `hand-craft`
- **用户可见名称**：手办创作（原「手伴创作」）
- **SOP 真源**：[`doc/手伴/skill.md`](../手伴/skill.md)

## 增量能力

1. **视觉风格**：预设（潮玩 3D 手办 / Q 版潮玩 / 扁平 / 国潮 / 赛博）+ 自定义文案；变更风格重置 hero 锁与后续产出
2. **助手 UI**：对齐微剧/Fashion 的 `SeedVideoAssistantChoiceCards`（图 1 大卡片 + 选中态 + 历史只读）
3. **Prompt 编辑**：槽位与预览统一「编辑 Prompt」；`ProductDesignPromptDialog` 使用 `nativeOverlay` 防 Radix 嵌套崩溃
4. **动态风格串**：`buildHandCraftSlotPrompt` 注入 `settings.stylePresetId` / `styleCustomText`，基准串不再硬编码示例角色配饰

## 待处理任务

| ID | 说明 |
|----|------|
| HC-101 | 用户可见文案「手办创作」 |
| HC-102 | `ecom-hand-craft-style-presets` + settings 字段 |
| HC-103 | `buildHandCraftSlotPrompt` 动态风格 + 换风格重置 |
| HC-104 | `hand-craft-assistant-choice-ui` + 助手面板卡片化 |
| HC-105 | `ProductDesignPromptDialog` nativeOverlay（手办页） |
| HC-106 | 预览内跳转编辑 Prompt |
| HC-107 | 产品文档 e-commerce-toolkit §手办更新 |
| HC-108 | 单元测试风格 fragment |
