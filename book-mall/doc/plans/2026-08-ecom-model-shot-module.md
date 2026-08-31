# 需求开发计划：服装模特图（model-shot）

- **创建日期**：2026-08-31
- **负责人**：电商工具箱
- **关联产品文档**：`doc/product/e-commerce-toolkit.md` §服装模特图
- **SOP / 助手话术真源**：`doc/模特姿势/skill.md`
- **数据库登记**：`doc/database/schema-changelog.md`

## 背景与目标

将 `/ecom/model-shot` 从占位 `GenerationWorkspace` 升级为完整 Studio：平台姿势/道具/场景库 + 故事版同款助手 + 中栏确认批量出图。

## 任务清单

### 文档
- [x] requirements.md / solution.md / skill.md / pose-matching-rules.md
- [x] 本计划文件
- [x] 更新 e-commerce-toolkit.md、模板管理后台.md、schema-changelog

### Catalog 后端
- [ ] Prisma Pose/Prop/Scene + migration + db:apply-pending
- [ ] 三库 service + Admin/SSO API
- [ ] seed 脚本 + 管理后台子 Tab

### Catalog 前端
- [ ] e-commerce-toolkit 三库 types/json/api

### Model-Shot 后端
- [ ] EcomModelShotProject + types/service/prompts/parse/pose-picker/image
- [ ] SSO API 全套

### Model-Shot 前端
- [ ] ModelShotStudio 三栏 UI
- [ ] 替换 GenerationWorkspace + Background Dock

### 质量
- [ ] 单元测试
- [ ] 删除二次确认

## 验收标准

见 `doc/模特姿势/requirements.md` §6。
