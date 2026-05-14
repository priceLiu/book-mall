# 开发约束与文档维护

## 1. 适用范围

本仓库在扩展为 **AI Mall** 全站能力时，全体贡献者（含 AI 辅助开发）须遵守本节。

## 2. 开工前必读

1. 阅读 **[doc/README.md](../README.md)**，定位与本次需求相关的 **产品分册**（`doc/product/*.md`）。  
2. **禁止** 在未对照文档的情况下自行发明计费、层级、提现规则。若需求与文档冲突，**先改文档并评审**，再改代码。

## 3. 计划与进度勾选

1. 复制 **[feature-plan-template.md](../templates/feature-plan-template.md)** 到 **`doc/plans/`**，文件名建议 `YYYY-MM-DD-功能简称.md`。  
2. 列出可验收任务，实施过程中将 `[ ]` 改为 `[x]`。  
3. 或在项目管理工具（Issue）中维护等价清单，但须在计划文件或 Issue 描述中 **链接到对应产品分册段落**。

## 4. 文档归类（禁止单文件堆砌）

| 类型 | 存放位置 | 要求 |
|------|----------|------|
| 产品/业务规则 | `doc/product/` | 按现有分册更新；大改可新增分册并在 README 登记 |
| 数据库结构变更 | `doc/database/` | 至少在 `schema-changelog.md` **追加一条**；大变更可另建 `YYYY-MM-DD-摘要.md` |
| 功能逻辑、状态机、边界 case | `doc/logic/` | **独立文件**，如 `metering-settlement.md`，勿全部挤进 `product.md` |
| 技术环境 | `doc/tech/` | 部署、依赖、环境变量 **名称**（不含密钥） |

## 5. 数据库文档最小字段

每次迁移或手工改表，changelog 须包含：**日期、作者、变更摘要、涉及表/字段、回滚提示（如有）**。

## 6. Cursor / AI 协作

项目规则见 **`.cursor/rules/ai-mall-product-doc.mdc`**，与本文档一致。
