/**
 * 作品墙自由画布 · 挂件注册表（唯一入口）
 *
 * 新增挂件只需：
 *   1. 在 types.ts 的 SPACE_BLOCK_TYPES 加类型、补 config 类型与 SPACE_BLOCKS 条目
 *   2. 在 components/ai-space/space-blocks/renderers.tsx 注册 View / Inspector
 *
 * **禁止**在编辑器、公开页或任何业务组件里写 `blockType === "xxx"` 分支。
 * 约束见 .cursor/rules/ai-space-space-blocks.mdc。
 */

export * from "./types";
export * from "./size-tiers";
export * from "./page-templates";
export * from "./theme";
