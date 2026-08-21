# 需求开发计划：全站访问统计 Phase 1

- **创建日期**：2026-08-21  
- **关联产品文档**：[26-platform-traffic-analytics.md](../product/26-platform-traffic-analytics.md)

## 背景与目标

Book 管理后台需轻量化查看各应用每日 PV/UV 与 IP 访问明细；各子应用 middleware 异步上报，Book 汇聚。

## 任务清单

- [x] 已阅读 `doc/README.md` 及关联产品分册
- [x] 已在 `doc/database/schema-changelog.md` 登记设计
- [x] Prisma 两表 + migration + db:apply-pending + db:generate
- [x] `lib/site-traffic/*` + internal API + 单元测试
- [x] `shared/platform-traffic` + 各 app docker-shared / middleware
- [x] `/admin/traffic` + admin-nav + 驾驶舱 KPI
- [x] `.env.example` + deploy 说明

## 验收标准

见产品文档 §9。
