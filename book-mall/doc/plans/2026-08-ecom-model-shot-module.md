# 需求开发计划：服装模特图（model-shot）

- **创建日期**：2026-08-31
- **负责人**：电商工具箱
- **关联产品文档**：`doc/product/e-commerce-toolkit.md` §服装模特图
- **SOP / 助手话术真源**：`doc/模特姿势/skill.md`
- **数据库登记**：`doc/database/schema-changelog.md`

## 背景与目标

将 `/ecom/model-shot` 从占位 `GenerationWorkspace` 升级为完整 Studio：平台姿势/道具/场景库 + 故事版同款助手 + 中栏确认批量出图。

## Phase 1 · MVP（已完成）

### 文档
- [x] requirements.md / solution.md / skill.md / pose-matching-rules.md
- [x] 本计划文件
- [x] 更新 e-commerce-toolkit.md、模板管理后台.md、schema-changelog

### Catalog 后端
- [x] Prisma Pose/Prop/Scene + migration + db:apply-pending
- [x] 三库 service + Admin/SSO API
- [x] seed 脚本 + 管理后台子 Tab

### Catalog 前端
- [x] e-commerce-toolkit 三库 types/json/api

### Model-Shot 后端
- [x] EcomModelShotProject + types/service/prompts/parse/pose-picker/image
- [x] SSO API 全套

### Model-Shot 前端
- [x] ModelShotStudio 三栏 UI
- [x] 替换 GenerationWorkspace + Background Dock

## Phase 2 · V2 场景匹配 + 道具表填 + 用户资产库（待处理）

### 文档
- [ ] requirements.md V2 流程与资产库
- [ ] solution.md / skill.md / pose-matching-rules 规则四
- [ ] e-commerce-toolkit.md §shoot-catalog
- [ ] schema-changelog scope/userId/lockedAt

### 场景准确匹配
- [ ] 场景 catalog.json 补 tags + seed
- [ ] scene-pose-rules.ts + pose-picker 场景维
- [ ] generateModelShotPosePlan 加载 scene catalog
- [ ] 单测 + admin tags 表单

### 道具后置 + 姿势表
- [ ] 去掉助手 prop 采集阶段（两选项）
- [ ] phases / workflow / ref-uploader 同步
- [ ] ModelShotPoseItem sceneCatalogId / propCatalogId
- [ ] 场景/道具 picker dialog + 应用到全部

### 用户资产库
- [ ] Prisma scope / userId / lockedAt 迁移
- [ ] listForUser + 用户 CRUD SSO API
- [ ] touchCatalogLockOnProjectUse
- [ ] /ecom/shoot-catalog 用户页 + studio 入口

### 质量
- [ ] 单元测试（场景匹配 + lock）
- [ ] 用户库删除二次确认

## 验收标准

见 `doc/模特姿势/requirements.md` §6。
