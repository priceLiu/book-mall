/**
 * 初始化「待做功能」清单（按标题幂等 upsert）。
 * 用法：cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/seed-admin-pending-features.ts
 */
import { prisma } from "@/lib/prisma";

const SEED_ITEMS: {
  title: string;
  description: string;
  docPath?: string;
  sortOrder: number;
  listKind?: "FEATURE" | "PENDING";
  completed?: boolean;
}[] = [
  {
    title: "运营中心",
    description: "统一运营数据看板、活动配置与子站入口聚合。",
    sortOrder: 10,
  },
  {
    title: "小红书标签",
    description: "小红书内容标签分析与推荐，辅助选题与发布。",
    sortOrder: 20,
  },
  {
    title: "标题热词",
    description: "标题热词挖掘与推荐，提升内容点击率。",
    sortOrder: 30,
  },
  {
    title: "文章热词",
    description: "正文热词分析与 SEO/选题辅助。",
    sortOrder: 40,
  },
  {
    title: "爆款视频拆解",
    description: "爆款视频结构拆解、分镜与节奏学习工具。",
    sortOrder: 50,
  },
  {
    title: "拉片",
    description: "拉片学习与分镜拆解，辅助影视创作与镜头语言分析。",
    docPath: "docs/拉片.md",
    sortOrder: 55,
  },
  {
    title: "姿势 skill",
    description: "姿势生成/编辑 Agent Skill，供画布与工具站复用。",
    sortOrder: 60,
  },
  {
    title: "提示词库",
    description: "全站提示词模板库，支持分类、版本与共享。",
    sortOrder: 70,
  },
  {
    title: "一键发布",
    description: "多平台内容一键发布（Publisher），含扩展与桌面端。",
    docPath: "docs/一键发布平台.md",
    sortOrder: 80,
  },
  {
    title: "数字人",
    description: "数字人形象创建、驱动与视频合成能力。",
    sortOrder: 90,
  },
  {
    title: "自动剪辑",
    description: "云端 Media Render 自动剪辑成片（book-mall 服务端 ffmpeg）。",
    docPath: "docs/自动剪辑.md",
    sortOrder: 100,
  },
  {
    title: "ep",
    description: "火山视频 EP 接入池：按凭证配置 ep-* 选路，替换 env 临时方案。",
    docPath: "docs/ep.md",
    sortOrder: 105,
  },
  {
    title: "image out painting",
    description: "阿里云 image-out-painting 图像画面扩展（扩图），适配布局与拓宽视野。",
    docPath: "docs/image out painting.md",
    sortOrder: 108,
  },
  {
    title: "wen",
    description: "千问图像编辑（qwen-image）多图输入输出、文字与物体编辑。",
    docPath: "docs/wen.md",
    sortOrder: 112,
  },
  {
    title: "wan 图像局部",
    description: "万相图像局部重绘（vary-region / wanx-x-painting）。",
    docPath: "docs/wan 图像局部.md",
    sortOrder: 114,
  },
  {
    title: "wan 2.0 i2i preview",
    description: "万相 2.0 通用图像编辑（wan2.5 i2i 预览能力接入）。",
    docPath: "docs/wan 2.0 i2i preview.md",
    sortOrder: 116,
  },
  {
    title: "platform-apps-catalog",
    description: "平台应用总览与 AI 小智导览知识库（对外可讲的应用清单）。",
    docPath: "docs/platform-apps-catalog.md",
    sortOrder: 118,
  },
  {
    title: "v2.5",
    description: "CineCanvas 影视 AI 全流程协同平台 V2.5 柔性工作流方案。",
    docPath: "docs/v2.5.md",
    sortOrder: 120,
  },
  {
    title: "Gateway 统一注册登录",
    description: "Gateway 与 Book 统一账号注册/登录，单点互通，消除独立 Gateway 账号体系。",
    sortOrder: 122,
  },
  {
    title: "域名静态化管理",
    description: "多域名静态资源、路由与 CDN 配置统一管理。",
    docPath: "docs/域名静态化管理方案.md",
    sortOrder: 110,
  },
  {
    title: "自动成片升级",
    description: "统一烧录字幕字体/字号、三端 UI、轻量剪辑台前置协议。",
    docPath: "docs/自动成片升级方案.md",
    sortOrder: 102,
    listKind: "PENDING",
  },
  {
    title: "模型与应用管理",
    description:
      "模型调用地图：全站应用×页面×功能点的模型清单、用量统计与分级配置（L6 调用点绑定）。",
    docPath: "docs/模型与应用管理.md",
    sortOrder: 125,
  },
  // —— 对账 Phase 2（待处理 · 见 docs/对账需求.md）——
  {
    title: "对账需求 · 总规格",
    description: "两阶段预算/对账/收益框架、口径对照与验收标准（SSOT）。",
    docPath: "docs/对账需求.md",
    sortOrder: 200,
    listKind: "PENDING",
  },
  {
    title: "AR-106 总表预估净成本列",
    description: "Gateway 用量 × 净成本（costSnapshot/ModelCostProfile.netCost）汇总列。",
    docPath: "docs/对账需求.md",
    sortOrder: 210,
    listKind: "PENDING",
    completed: true,
  },
  {
    title: "AR-107 总表用户实收与行级毛利",
    description: "展示 platformRevenueYuan 与 实收−净成本；与驾驶舱/P&L 一致。",
    docPath: "docs/对账需求.md",
    sortOrder: 220,
    listKind: "PENDING",
    completed: true,
  },
  {
    title: "AR-108 对账列头口径说明",
    description: "区分挂牌预算、对账差额、用户实收；消除平台挂牌误读。",
    docPath: "docs/对账需求.md",
    sortOrder: 230,
    listKind: "PENDING",
    completed: true,
  },
  {
    title: "AR-109 对账总表顶栏 KPI",
    description: "预算净成本、已对账差额、实收、毛利四象限汇总。",
    docPath: "docs/对账需求.md",
    sortOrder: 240,
    listKind: "PENDING",
    completed: true,
  },
  {
    title: "AR-103 费用概览按日 P&L",
    description: "usage-overview 增加按日损益 Tab，与 P&L 同源。",
    docPath: "docs/对账需求.md",
    sortOrder: 250,
    listKind: "PENDING",
    completed: true,
  },
  {
    title: "AR-104 ASR 历史秒数回填",
    description: "回填 Gateway 日志 audioDurationSec，收敛 ASR UNDER_PLATFORM。",
    docPath: "docs/阿里对账.md",
    sortOrder: 260,
    listKind: "PENDING",
    completed: true,
  },
  {
    title: "AR-105 S2V 非 Gateway 缺口排查",
    description: "wan2.2-s2v 等平台用量与阿里 CSV 59.3s 缺口根因。",
    docPath: "docs/阿里对账.md",
    sortOrder: 270,
    listKind: "PENDING",
    completed: true,
  },
  {
    title: "AR-110 成本档关旧开新 · 全量脚本",
    description: "seed/价目导入脚本统一走 upsertModelCostProfileVersioned。",
    docPath: "docs/对账需求.md",
    sortOrder: 280,
    listKind: "PENDING",
    completed: true,
  },
  // —— 分享规则 2.0（见 docs/分享规则.md）——
  {
    title: "分享规则 · 总规格",
    description: "双轨分享 SSOT：邀请 20 分 + 工作流 40 分，全积分、先到先得、首笔订阅/充值。",
    docPath: "docs/分享规则.md",
    sortOrder: 300,
    listKind: "PENDING",
    completed: true,
  },
  {
    title: "SR-101 分享奖励引擎",
    description: "ShareRewardService + ShareRewardAttribution 归因锁定与发奖。",
    docPath: "docs/分享规则.md",
    sortOrder: 310,
    listKind: "PENDING",
    completed: true,
  },
  {
    title: "SR-102 邀请分享改积分",
    description: "/r/ 注册+首笔付费 → 20 积分；退役现金返佣新出单。",
    docPath: "docs/分享规则.md",
    sortOrder: 320,
    listKind: "PENDING",
    completed: true,
  },
  {
    title: "SR-103 工作流分享 · 画布",
    description: "WorkflowShareLink/Claim + canvas /share/w/{token} + clone。",
    docPath: "docs/分享规则.md",
    sortOrder: 330,
    listKind: "PENDING",
    completed: true,
  },
  {
    title: "SR-104 工作流分享 · 电商/快速复刻",
    description: "e-commerce-toolkit + quick-replica-web duplicate 与分享 UI。",
    docPath: "docs/分享规则.md",
    sortOrder: 340,
    listKind: "PENDING",
    completed: true,
  },
  {
    title: "SR-105 财务后台配置",
    description: "referralRewardCredits / workflowShareRewardCredits 等 finance-web 配置。",
    docPath: "docs/分享规则.md",
    sortOrder: 350,
    listKind: "PENDING",
    completed: true,
  },
  {
    title: "SR-106 订阅页分享展示",
    description: "pricing 页分享得积分说明卡片 + CTA。",
    docPath: "docs/分享规则.md",
    sortOrder: 360,
    listKind: "PENDING",
    completed: true,
  },
  {
    title: "SR-107 全应用充值 returnTo",
    description: "checkout returnTo 深链 + 各应用充值/不足弹层（不重做支付）。",
    docPath: "docs/分享规则.md",
    sortOrder: 370,
    listKind: "PENDING",
    completed: true,
  },
  // —— 分享链接 3.0（见 docs/分享链接.md）——
  {
    title: "SC-300 分享链接 · 总规格",
    description: "码优先 + 统一 /code 兑换 + 微信 QR；前缀注册表 SSOT。",
    docPath: "docs/分享链接.md",
    sortOrder: 375,
    listKind: "PENDING",
    completed: true,
  },
  {
    title: "SC-301 ShareCodePrefix 注册表",
    description: "schema + seed + admin 前缀映射（仅管理员可见）。",
    docPath: "docs/分享链接.md",
    sortOrder: 380,
    listKind: "PENDING",
    completed: true,
  },
  {
    title: "SC-302 share-code resolve/claim 服务",
    description: "统一解析邀请/工作流码 + IP 限流 + legacy fallback。",
    docPath: "docs/分享链接.md",
    sortOrder: 385,
    listKind: "PENDING",
    completed: true,
  },
  {
    title: "SC-303 主站 /code 页面",
    description: "输入页 + /code/[code] 分流 + QR PNG API。",
    docPath: "docs/分享链接.md",
    sortOrder: 390,
    listKind: "PENDING",
    completed: true,
  },
  {
    title: "SC-304 邀请分享 UI",
    description: "referral-panel 码+链+QR；register 可选邀请码预填。",
    docPath: "docs/分享链接.md",
    sortOrder: 395,
    listKind: "PENDING",
    completed: true,
  },
  {
    title: "SC-305 工作流短码生成",
    description: "WorkflowShareLink.shortCode + create API 返回 shareUrl。",
    docPath: "docs/分享链接.md",
    sortOrder: 400,
    listKind: "PENDING",
    completed: true,
  },
  {
    title: "SC-306 三应用分享弹层",
    description: "canvas / ecom / quick-replica 展示 10 位码 + 主站链 + QR。",
    docPath: "docs/分享链接.md",
    sortOrder: 405,
    listKind: "PENDING",
    completed: true,
  },
  {
    title: "SC-307 存量兼容与回填",
    description: "邀请 legacy 8 位码 fallback；workflow backfill shortCode。",
    docPath: "docs/分享链接.md",
    sortOrder: 410,
    listKind: "PENDING",
    completed: true,
  },
  {
    title: "SC-308 单元测试",
    description: "resolve 路由、碰撞、legacy fallback、disabled prefix。",
    docPath: "docs/分享链接.md",
    sortOrder: 415,
    listKind: "PENDING",
    completed: true,
  },
  // —— 大流量页静态快照（见 docs/静态化.md）——
  {
    title: "静态化 · 总规格",
    description: "主站/画布门户 StaticPageSnapshot：Cron 预生成、ISR/SSR 读快照、ST-* 台账。",
    docPath: "docs/静态化.md",
    sortOrder: 380,
    listKind: "PENDING",
  },
  {
    title: "ST-101 快照模型与迁移",
    description: "StaticPageSnapshot + StaticSnapshotGenerationRun；db:apply-pending。",
    docPath: "docs/静态化.md",
    sortOrder: 390,
    listKind: "PENDING",
    completed: true,
  },
  {
    title: "ST-102 site-home 快照与 ISR",
    description: "主站首页 Hero/平台应用/Gateway 模型；revalidate=86400；CLI/Cron。",
    docPath: "docs/静态化.md",
    sortOrder: 400,
    listKind: "PENDING",
    completed: true,
  },
  {
    title: "ST-103 canvas-home 快照与 SSR",
    description: "画布门户精选/模板/案例/视频墙；公开 API + canvas-web SSR。",
    docPath: "docs/静态化.md",
    sortOrder: 410,
    listKind: "PENDING",
    completed: true,
  },
  {
    title: "ST-104 静态资源管理页",
    description: "/admin/static-snapshots 双 Tab、生成流水、手动触发生成。",
    docPath: "docs/静态化.md",
    sortOrder: 420,
    listKind: "PENDING",
    completed: true,
  },
  {
    title: "ST-105 Cron pageKey=all",
    description: "一次 Cron 生成 site-home + canvas-home；vercel.json + deploy 文档。",
    docPath: "docs/静态化.md",
    sortOrder: 430,
    listKind: "PENDING",
    completed: true,
  },
  {
    title: "ST-106 移除门户冗余 API 拉数",
    description: "画布首页不再客户端拉 portal-*；匿名 GET 白名单收紧。",
    docPath: "docs/静态化.md",
    sortOrder: 440,
    listKind: "PENDING",
    completed: true,
  },
  {
    title: "ST-107 最近项目实时与分享刷新",
    description: "最近项目不走快照；分享/投稿后 markRecentProjectsStale + bump updatedAt。",
    docPath: "docs/静态化.md",
    sortOrder: 450,
    listKind: "PENDING",
    completed: true,
  },
  {
    title: "ST-108 清理废弃主站平台卡片组件",
    description: "删除 site-home-platform-app-card.tsx，统一 rotator。",
    docPath: "docs/静态化.md",
    sortOrder: 460,
    listKind: "PENDING",
    completed: true,
  },
  {
    title: "ST-201 Phase 2 定价/模型市场快照",
    description: "pricing、gateway-market、pricing-api 复用 StaticPageSnapshot。",
    docPath: "docs/静态化.md",
    sortOrder: 470,
    listKind: "PENDING",
  },
  {
    title: "ST-202 生产 Cron 与首次验收",
    description: "CloudBase 05:30 CST 定时 HTTP；管理页确认 READY 与首页/画布目检。",
    docPath: "docs/静态化.md",
    sortOrder: 480,
    listKind: "PENDING",
  },
  {
    title: "ST-203 快照失败告警",
    description: "连续 FAILED 或当日无 READY 时运维通知（待选型）。",
    docPath: "docs/静态化.md",
    sortOrder: 490,
    listKind: "PENDING",
  },
  {
    title: "ST-204 分享后触发 canvas-home 增量生成",
    description: "门户发布后立即 regenerate canvas-home（可选，替代仅等 Cron）。",
    docPath: "docs/静态化.md",
    sortOrder: 500,
    listKind: "PENDING",
  },
];

async function main() {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of SEED_ITEMS) {
    const existing = await prisma.adminPendingFeature.findFirst({
      where: { title: item.title },
    });
    if (existing) {
      if (item.completed === true && !existing.completed) {
        await prisma.adminPendingFeature.update({
          where: { id: existing.id },
          data: { completed: true },
        });
        updated += 1;
        console.log(`[pending-feature] ✓ ${item.title}`);
      } else {
        skipped += 1;
      }
      continue;
    }
    await prisma.adminPendingFeature.create({
      data: {
        title: item.title,
        description: item.description,
        docPath: item.docPath ?? "",
        listKind: item.listKind ?? "FEATURE",
        sortOrder: item.sortOrder,
        completed: item.completed ?? false,
      },
    });
    created += 1;
    console.log(`[pending-feature] + ${item.title}`);
  }

  console.log(
    `[pending-feature] 完成：新增 ${created}，标记完成 ${updated}，已存在 ${skipped}，合计 ${SEED_ITEMS.length}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
