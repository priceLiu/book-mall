# IP 母版 · 产品需求

- **创建日期**：2026-10-03
- **入口**：`/brand/ip`（电商工具箱 · 营销 · IP创作）
- **toolKey**：`ecom-toolkit__ip`（`character`）
- **产品真源**：[`docs/IP母版PRD.md`](../../../docs/IP母版PRD.md)
- **助手 Skill**：[`docs/IP母版 skill.md`](../../../docs/IP母版%20skill.md)

## 1. 一句话说明

将角色基准图或文字描述结构化为 **IP 母版模板**（刚性锚点 + 柔性可变项 + 特例放行），版本化管理；**手办盲盒 SOP**、**品牌VI表情包SOP** 可载入母版固定参考图并在生图 Prompt 追加约束。工作台壳层与手办/VI 一致，**无逐步解锁**。

## 2. 输入

- **方式 A**：1 张角色基准图（线稿 / 立绘 / 头像 / 已有产物）
- **方式 B**：文字描述（自然语言；缺失项标「待补充」，不编造）
- 二者可并存

## 3. 步骤（逻辑步，非批量出图槽位）

| # | stepId | 说明 |
|---|--------|------|
| 1 | input | 上传基准图、填写 brief |
| 2 | extract | LLM 图生/文生解析为模板草稿 |
| 3 | review | 用户编辑 Markdown 模板 |
| 4 | versions | 保存版本、选当前版、历史列表 |

步间 `requires: []`；进度轨任意步可点；助手不阻塞跳步。

## 4. 数据

- `references[]`：下游读取的 **固定基准图**（OSS URL）
- `brief`：角色文字描述
- `meta.templateVersions[]`：`{ version, markdown, json, source, createdAt }`；保存时版本 +0.1
- `meta.workflow.activeVersion`：当前生效版号

机读 JSON 结构见 PRD §6.2；人读 Markdown 见 PRD §6.1 / Skill §六。

## 5. 下游（同一期）

- 手办 / VI `settings.ipMasterProjectId`、`settings.ipMasterVersion`
- 载入：复制母版 `references` + 服务端 `buildIpMasterConstraintBlock` 追加至槽位 Prompt
- 无母版：原流程不变
- FR-6 冲突三选一：后续迭代；首版载入时 toast 提醒

## 6. 验收标准

1. 图生/文生 → 校对 → 保存 V1.0 → 编辑 → V1.1
2. 保存工作流镜像至「我的资产 · IP 母版」
3. 手办/VI 参考区「从 IP 母版载入」可带出基准图并出图含刚性锚点约束
4. `/admin/pending-features` 可见 IM-* 待办

## 7. 品牌 VI 增量（同批）

| ID | 说明 |
|----|------|
| VI-119 | 拼版 upload 后 `onApplyProject` 快照；空白 canvas 防护 |
| VI-120 | `canStartBrandViStep` + 助手跳步（第 8 步硬依赖不含第 7 步） |

第 7 步 `vi-spec` 依赖：hero、logo、turnaround。第 8 步 `portfolio` 依赖：hero、emoji、merch（**不含** vi-spec）。

## 8. 待处理任务（与 seed 脚本一致）

| ID | 说明 |
|----|------|
| IM-总规格 | 独立 Studio + 下游载入 |
| IM-101 | Prisma `EcomIpMasterProject` + 迁移 |
| IM-102 | 步骤与模板 Markdown/JSON |
| IM-103 | service CRUD + 版本 save |
| IM-104 | assistant/chat + extract |
| IM-105 | refs upload/attach |
| IM-106 | SSO API 路由全集 |
| IM-107 | IpMasterStudio + `/brand/ip` |
| IM-108 | save/reuse library drafts |
| IM-109 | 手办/VI 载入 + Prompt 注入 |
| IM-110 | 单测 |
| IM-111 | 架构文档 + dev 说明 |

## 9. 非目标（后续）

- FR-6 完整三选一弹窗、生成后锚点破坏检测、模板导入导出、多角色模板库
