import { PrismaClient } from "@prisma/client";
import { applyMockSubscriptionPayment } from "../lib/apply-mock-subscription";

const prisma = new PrismaClient();

const PILOT_SYNC_EMAIL = "13808816802@126.com";

async function syncPilotSubscriptions(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.warn(`[seed] 未找到账号 ${email}，跳过试点订阅同步`);
    return;
  }
  try {
    await applyMockSubscriptionPayment(user.id, "monthly");
  } catch (e) {
    console.warn("[seed] 试点会员计划写入异常（若已有订阅可忽略）:", e);
  }

  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + 365);

  const toolProducts = await prisma.product.findMany({
    where: { kind: "TOOL", status: "PUBLISHED" },
  });
  for (const p of toolProducts) {
    if (!p.toolNavKey?.trim()) continue;
    await prisma.userProductSubscription.upsert({
      where: { userId_productId: { userId: user.id, productId: p.id } },
      create: {
        userId: user.id,
        productId: p.id,
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: end,
      },
      update: { status: "ACTIVE", currentPeriodEnd: end },
    });
  }

  const knowledgeProducts = await prisma.product.findMany({
    where: { kind: "KNOWLEDGE", status: "PUBLISHED" },
  });
  for (const p of knowledgeProducts) {
    await prisma.userProductSubscription.upsert({
      where: { userId_productId: { userId: user.id, productId: p.id } },
      create: {
        userId: user.id,
        productId: p.id,
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: end,
      },
      update: { status: "ACTIVE", currentPeriodEnd: end },
    });
  }

  console.log(`[seed] 已为试点账号 ${email} 同步会员计划及单品工具/课程订阅`);
}

async function main() {
  await prisma.platformConfig.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });

  await prisma.subscriptionPlan.upsert({
    where: { slug: "monthly" },
    create: {
      slug: "monthly",
      name: "月度订阅",
      interval: "MONTH",
      pricePoints: 2990,
      active: true,
    },
    update: {
      name: "月度订阅",
      pricePoints: 2990,
      active: true,
      toolsNavAllowlist: [],
    },
  });

  await prisma.subscriptionPlan.upsert({
    where: { slug: "yearly" },
    create: {
      slug: "yearly",
      name: "年度订阅",
      interval: "YEAR",
      pricePoints: 29900,
      active: true,
    },
    update: {
      name: "年度订阅",
      pricePoints: 29900,
      active: true,
      toolsNavAllowlist: [],
    },
  });

  const adminEmails =
    process.env.ADMIN_EMAILS?.split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean) ?? [];
  for (const email of adminEmails) {
    const r = await prisma.user.updateMany({
      where: { email },
      data: { role: "ADMIN" },
    });
    if (r.count > 0) console.log(`已设为管理员: ${email}`);
  }

  await prisma.productCategory.upsert({
    where: { slug: "ai-courses" },
    create: {
      name: "AI 课程",
      slug: "ai-courses",
      kind: "KNOWLEDGE",
      sortOrder: 0,
    },
    update: { name: "AI 课程", kind: "KNOWLEDGE", sortOrder: 0 },
  });
  await prisma.productCategory.upsert({
    where: { slug: "ai-apps" },
    create: {
      name: "AI 应用",
      slug: "ai-apps",
      kind: "TOOL",
      sortOrder: 0,
    },
    update: { name: "AI 应用", kind: "TOOL", sortOrder: 0 },
  });

  const appsCat = await prisma.productCategory.findUnique({
    where: { slug: "ai-apps" },
  });
  const coursesCat = await prisma.productCategory.findUnique({
    where: { slug: "ai-courses" },
  });

  /** 首页「推荐产品」封面：按应用场景区分，便于识别 */
  const coverAiFit =
    "https://images.unsplash.com/photo-1531746797559-117fa8cfb90d?auto=format&fit=crop&w=600&q=85";
  const coverTextToImage =
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=85";
  const coverSmartSupport =
    "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=600&q=85";
  const coverCoursePrompt =
    "https://images.unsplash.com/photo-1517842645767-c639b880efb6?auto=format&fit=crop&w=600&q=85";
  const coverCourseWorkflow =
    "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=600&q=85";

  await prisma.product.upsert({
    where: { slug: "tool-ai-fit" },
    create: {
      title: "AI智能试衣",
      slug: "tool-ai-fit",
      summary: "虚拟试穿与云衣柜，基于阿里云百炼视觉大模型；按次计费，入口在独立工具站。",
      description:
        "在 **个人中心** 打开 AI 工具站 → 侧栏 **试衣间 → AI智能试衣**。\n\n须满足黄金会员、有效订阅与余额规则；详见订阅中心与工具站公示。",
      kind: "TOOL",
      tier: "ADVANCED",
      coverImageUrl: coverAiFit,
      status: "PUBLISHED",
      featuredHome: true,
      featuredSort: 30,
      categoryId: appsCat?.id ?? null,
      toolNavKey: "fitting-room",
      toolPermissions: "工具站套件 navKey：fitting-room",
      meteringNote: "按成功成片计入费用明细。",
    },
    update: {
      title: "AI智能试衣",
      summary: "虚拟试穿与云衣柜，基于阿里云百炼视觉大模型；按次计费，入口在独立工具站。",
      description:
        "在 **个人中心** 打开 AI 工具站 → 侧栏 **试衣间 → AI智能试衣**。\n\n须满足黄金会员、有效订阅与余额规则；详见订阅中心与工具站公示。",
      kind: "TOOL",
      tier: "ADVANCED",
      coverImageUrl: coverAiFit,
      status: "PUBLISHED",
      featuredHome: true,
      featuredSort: 30,
      categoryId: appsCat?.id ?? null,
      toolNavKey: "fitting-room",
      toolPermissions: "工具站套件 navKey：fitting-room",
      meteringNote: "按成功成片计入费用明细。",
    },
  });

  await prisma.product.upsert({
    where: { slug: "tool-text-to-image" },
    create: {
      title: "文生图",
      slug: "tool-text-to-image",
      summary: "文本生成图像，支持图片库与按量结算；入口在独立工具站。",
      description:
        "在 **个人中心** 打开 AI 工具站 → 侧栏 **文生图**。\n\n须满足黄金会员、有效订阅与余额规则。",
      kind: "TOOL",
      tier: "ADVANCED",
      coverImageUrl: coverTextToImage,
      status: "PUBLISHED",
      featuredHome: true,
      featuredSort: 20,
      categoryId: appsCat?.id ?? null,
      toolNavKey: "text-to-image",
      toolPermissions: "工具站套件 navKey：text-to-image",
      meteringNote: "按生成任务与模型档位计费。",
    },
    update: {
      title: "文生图",
      summary: "文本生成图像，支持图片库与按量结算；入口在独立工具站。",
      description:
        "在 **个人中心** 打开 AI 工具站 → 侧栏 **文生图**。\n\n须满足黄金会员、有效订阅与余额规则。",
      kind: "TOOL",
      tier: "ADVANCED",
      coverImageUrl: coverTextToImage,
      status: "PUBLISHED",
      featuredHome: true,
      featuredSort: 20,
      categoryId: appsCat?.id ?? null,
      toolNavKey: "text-to-image",
      toolPermissions: "工具站套件 navKey：text-to-image",
      meteringNote: "按生成任务与模型档位计费。",
    },
  });

  await prisma.product.upsert({
    where: { slug: "tool-smart-support" },
    create: {
      title: "AI智能客服",
      slug: "tool-smart-support",
      summary: "DeepSeek 大模型与 Dify 编排的企业级智能客服；7×24 在线、知识库与多轮对话，入口在独立工具站。",
      description:
        "在 **个人中心** 打开 AI 工具站 → 侧栏 **AI智能客服 → 我的智能客服**。\n\n须满足黄金会员、有效订阅与余额规则。",
      kind: "TOOL",
      tier: "ADVANCED",
      coverImageUrl: coverSmartSupport,
      status: "PUBLISHED",
      featuredHome: true,
      featuredSort: 10,
      categoryId: appsCat?.id ?? null,
      toolNavKey: "smart-support",
      toolPermissions: "工具站套件 navKey：smart-support",
      meteringNote: "按对话计费策略见工具站说明。",
    },
    update: {
      title: "AI智能客服",
      summary: "DeepSeek 大模型与 Dify 编排的企业级智能客服；7×24 在线、知识库与多轮对话，入口在独立工具站。",
      description:
        "在 **个人中心** 打开 AI 工具站 → 侧栏 **AI智能客服 → 我的智能客服**。\n\n须满足黄金会员、有效订阅与余额规则。",
      kind: "TOOL",
      tier: "ADVANCED",
      coverImageUrl: coverSmartSupport,
      status: "PUBLISHED",
      featuredHome: true,
      featuredSort: 10,
      categoryId: appsCat?.id ?? null,
      toolNavKey: "smart-support",
      toolPermissions: "工具站套件 navKey：smart-support",
      meteringNote: "按对话计费策略见工具站说明。",
    },
  });

  const promptCourseJson = JSON.stringify({
    level: "入门",
    lessons: [
      {
        title: "大模型能做什么 / 不能做什么",
        durationMin: 18,
        bodyMd:
          "## 本节要点\n- 生成类能力与幻觉边界。\n- 何时必须人工复核。\n\n可在学完本节后点击「标记本节已完成」。",
      },
      {
        title: "清晰任务描述与输出格式",
        durationMin: 22,
        bodyMd:
          "## 结构化 Prompt\n使用编号列表约束模型输出 JSON 或表格。\n",
      },
      {
        title: "常见幻觉与复核清单",
        durationMin: 15,
        bodyMd:
          "## 自检清单\n- 来源是否可追溯。\n- 是否与业务策略冲突。\n",
      },
    ],
  });

  const workflowCourseJson = JSON.stringify({
    level: "进阶",
    lessons: [
      {
        title: "需求拆解与评测集",
        durationMin: 25,
        bodyMd: "## 交付前先定义评测样本与通过阈值。\n",
      },
      {
        title: "API、工具站与主站钱包",
        durationMin: 30,
        bodyMd:
          "## 计费链路\n主站钱包扣减 ← 工具站用量打点 ← 推理接口。\n",
      },
      {
        title: "上线前体检（成本 / 延迟 / 风控）",
        durationMin: 20,
        bodyMd: "## Go-live Checklist\n- p95 延迟。\n- 单次调用成本上限。\n",
      },
    ],
  });

  await prisma.product.upsert({
    where: { slug: "prompt-engineering-basics" },
    create: {
      title: "Prompt 工程入门（学堂）",
      slug: "prompt-engineering-basics",
      summary:
        "面向业务同学的提示词结构、约束与安全红线；会员.subscription 解锁学习与进度。",
      description:
        "对应前台 **AI 学堂** 条目；详情页可进入 **开始学习**。学习与订阅联动规则见页面脚注。",
      courseContent: promptCourseJson,
      kind: "KNOWLEDGE",
      tier: "BASIC",
      coverImageUrl: coverCoursePrompt,
      status: "PUBLISHED",
      featuredHome: false,
      featuredSort: 0,
      categoryId: coursesCat?.id ?? null,
    },
    update: {
      title: "Prompt 工程入门（学堂）",
      summary:
        "面向业务同学的提示词结构、约束与安全红线；会员.subscription 解锁学习与进度。",
      description:
        "对应前台 **AI 学堂** 条目；详情页可进入 **开始学习**。学习与订阅联动规则见页面脚注。",
      courseContent: promptCourseJson,
      kind: "KNOWLEDGE",
      tier: "BASIC",
      coverImageUrl: coverCoursePrompt,
      status: "PUBLISHED",
      categoryId: coursesCat?.id ?? null,
    },
  });

  await prisma.product.upsert({
    where: { slug: "ai-apps-workflow" },
    create: {
      title: "AI 应用编排实战（学堂）",
      slug: "ai-apps-workflow",
      summary: "工具编排、计费与交付流程设计；与工具站按量叙事对齐。",
      description:
        "进阶工作坊占位课时；适合已有 Prompt 基础的交付同学。**开始学习** 后记录课时完成情况。",
      courseContent: workflowCourseJson,
      kind: "KNOWLEDGE",
      tier: "ADVANCED",
      coverImageUrl: coverCourseWorkflow,
      status: "PUBLISHED",
      featuredHome: false,
      featuredSort: 0,
      categoryId: coursesCat?.id ?? null,
    },
    update: {
      title: "AI 应用编排实战（学堂）",
      summary: "工具编排、计费与交付流程设计；与工具站按量叙事对齐。",
      description:
        "进阶工作坊占位课时；适合已有 Prompt 基础的交付同学。**开始学习** 后记录课时完成情况。",
      courseContent: workflowCourseJson,
      kind: "KNOWLEDGE",
      tier: "ADVANCED",
      coverImageUrl: coverCourseWorkflow,
      status: "PUBLISHED",
      categoryId: coursesCat?.id ?? null,
    },
  });

  await prisma.toolNavVisibility.updateMany({
    where: { navKey: "smart-support" },
    data: { label: "AI智能客服" },
  });

  await prisma.toolNavVisibility.updateMany({
    where: { navKey: "image-to-video" },
    data: { label: "图生视频" },
  });

  await prisma.toolNavVisibility.updateMany({
    where: { navKey: "visual-lab" },
    data: { label: "视觉实验室" },
  });

  await syncPilotSubscriptions(PILOT_SYNC_EMAIL);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
