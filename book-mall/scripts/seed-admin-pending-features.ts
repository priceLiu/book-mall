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
    title: "模型与应用管理",
    description:
      "模型调用地图：全站应用×页面×功能点的模型清单、用量统计与分级配置（L6 调用点绑定）。",
    docPath: "docs/模型与应用管理.md",
    sortOrder: 125,
  },
];

async function main() {
  let created = 0;
  let skipped = 0;

  for (const item of SEED_ITEMS) {
    const existing = await prisma.adminPendingFeature.findFirst({
      where: { title: item.title },
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    await prisma.adminPendingFeature.create({
      data: {
        title: item.title,
        description: item.description,
        docPath: item.docPath ?? "",
        listKind: "FEATURE",
        sortOrder: item.sortOrder,
        completed: false,
      },
    });
    created += 1;
    console.log(`[pending-feature] + ${item.title}`);
  }

  console.log(
    `[pending-feature] 完成：新增 ${created}，已存在 ${skipped}，合计 ${SEED_ITEMS.length}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
