# AI 小智 · 知识库来源（维护 SSOT）

> 代码白名单：`book-mall/lib/platform-assistant/knowledge-allowlist.ts`  
> 入库脚本：`pnpm --dir book-mall assistant:index`（可选 `--dry-run` 只看切块数）  
> 设计说明：`docs/platform-assistant-design.md`

## 原则

1. **只收录对外可讲的功能与操作**，帮助用户找到应用、理解流程、完成创作。
2. **严禁入库**：`doc/plans/**`、`doc/finance/**`、定价/积分/成本/架构端口表、内部实施跟踪、Prompt dump、未脱敏运维文档。
3. **价格与计费**：由 `guardrails.ts` 拦截 + 引导至报价页；知识库不得包含可推断单价的细则。
4. 产品改名（如「快速复制」→「一键复刻」）须同步 **`docs/platform-apps-catalog.md`** 与白名单 `label`，然后重建索引。

## 分层

| 层级 | 用途 | 代表文件 |
|------|------|----------|
| intro | 平台是什么、应用地图 | `docs/platform-apps-catalog.md`、`docs/全站功能概述-20261004.md` |
| operational | 登录、个人中心、Gateway、财务查看、分享 | `04-user-center.md`、`Gateway-使用指南-20261004.md` |
| functional | 各应用怎么用、工作流、电商分工具指南 | `AI画布-使用指南-20261004.md`、`docs/ecom/user-guides/*` |

## 重建知识库（发布 checklist）

1. 改完白名单或正文 Markdown 后，本地：`pnpm --dir book-mall assistant:index --dry-run` 确认各文件切块数正常（无大量「跳过读取失败」）。
2. 管理后台确认 **向量检索已开启** 且 embedding 模型可用。
3. 执行：`pnpm --dir book-mall assistant:index`（会 embedding 并写入 `PlatformDocChunk`，并 **删除不在白名单内的旧 source**）。
4. 在任意子站打开 AI 小智，抽问：「平台有哪些应用」「AI 画布怎么开始」「电商详情页工具怎么选」验证召回。

## 变更记录

| 日期 | 说明 |
|------|------|
| 2026-10-15 | 基于现行使用指南（`*-20261004`、ecom/user-guides）全面重组白名单；移除内部规划/重复旧画布 doc；入库后 purge 非白名单 source |
