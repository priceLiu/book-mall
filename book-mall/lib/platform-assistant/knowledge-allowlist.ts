/**
 * 平台 AI 导览助手 · 知识白名单（SSOT）。
 * 仅清单内 Markdown 会切块入库；plans / finance / 定价 / 内部架构表一律禁止加入。
 * 维护说明见 book-mall/doc/product/platform-assistant-knowledge-sources.md
 */

export type KnowledgeCategory = "functional" | "operational" | "intro";

export type KnowledgeSource = {
  /** 相对仓库根路径 */
  path: string;
  category: KnowledgeCategory;
  /** 用于回答引用的可读名称 */
  label: string;
};

/** 按阅读顺序排列；重建索引时以 path 为唯一来源键。 */
export const KNOWLEDGE_ALLOWLIST: KnowledgeSource[] = [
  // —— 总览（回答「平台是什么 / 有哪些应用」）——
  { path: "docs/platform-apps-catalog.md", category: "intro", label: "平台应用总览" },
  { path: "docs/全站功能概述-20261004.md", category: "intro", label: "全站功能概述" },
  { path: "book-mall/doc/product/00-overview.md", category: "intro", label: "Book 产品总览" },

  // —— 账号、登录、个人中心、团队 ——
  { path: "book-mall/doc/product/04-user-center.md", category: "operational", label: "个人中心" },
  { path: "book-mall/doc/product/06-flows.md", category: "operational", label: "主要使用流程" },
  { path: "book-mall/doc/product/08-independent-tools-sso.md", category: "operational", label: "工具站与 SSO 登录互通" },
  { path: "book-mall/doc/product/15-team-usage-manual.md", category: "operational", label: "团队与公司版使用手册" },
  { path: "book-mall/doc/product/gateway-user-guide.md", category: "operational", label: "Gateway 用户需知" },
  { path: "docs/Gateway-使用指南-20261004.md", category: "operational", label: "Gateway 使用指南" },
  { path: "docs/财务管理-使用指南-20261004.md", category: "operational", label: "财务管理与积分用量" },
  { path: "docs/平台分享功能-使用指南-20261004.md", category: "operational", label: "平台分享功能" },
  { path: "book-mall/doc/product/我的AI空间.md", category: "functional", label: "我的 AI 空间" },

  // —— 各应用 · 产品说明（book-mall/doc/product）——
  { path: "book-mall/doc/product/e-commerce-toolkit.md", category: "functional", label: "电商工具箱产品说明" },
  {
    path: "book-mall/doc/product/ecom-product-creation-workflow.md",
    category: "functional",
    label: "电商产品主图与详情页创作",
  },
  { path: "book-mall/doc/product/quick-replica-platform.md", category: "functional", label: "一键复刻" },
  { path: "book-mall/doc/product/prompt-optimizer-platform.md", category: "functional", label: "提示词优化器" },
  {
    path: "book-mall/doc/product/16-project-assets-unified-design.md",
    category: "functional",
    label: "项目资产与跨应用素材",
  },

  // —— AI 画布 · 漫剧 · 影视工作流 ——
  { path: "docs/AI画布-使用指南-20261004.md", category: "functional", label: "AI 画布使用指南" },
  {
    path: "docs/AI画布-图片与视频节点编辑-使用指南-20261004.md",
    category: "functional",
    label: "AI 画布图片与视频节点",
  },
  { path: "docs/canvas.md", category: "functional", label: "AI 画布功能说明" },
  {
    path: "canvas-web/docs/canvas-portal-product-requirements.md",
    category: "functional",
    label: "AI 画布门户与发现区",
  },
  { path: "canvas-web/docs/story-editions-overview.md", category: "functional", label: "漫剧与影视版本总览" },
  {
    path: "canvas-web/docs/story-pro2-workflow-canonical.md",
    category: "functional",
    label: "影视专业版 2.0 工作流",
  },
  {
    path: "canvas-web/docs/story-pro-workflow-canonical.md",
    category: "functional",
    label: "影视专业版 1.0 工作流",
  },
  {
    path: "canvas-web/docs/storyboard-video-1.0-workflow-canonical.md",
    category: "functional",
    label: "分镜视频 1.0 工作流",
  },
  {
    path: "canvas-web/docs/story-pro-character-asset-workflow.md",
    category: "functional",
    label: "角色资产工作流",
  },
  { path: "canvas-web/docs/ref-video-workflow.md", category: "functional", label: "参考视频工作流" },
  { path: "docs/漫剧空间-使用指南-20261004.md", category: "functional", label: "漫剧空间使用指南" },

  // —— 电商工具箱 · 总览与选型 ——
  { path: "docs/ecom.md", category: "functional", label: "电商创作总览" },
  { path: "docs/ecom/user-guides/主图与套图工具怎么选.md", category: "functional", label: "主图与套图怎么选" },
  { path: "docs/ecom/user-guides/详情页工具怎么选.md", category: "functional", label: "详情页工具怎么选" },
  { path: "docs/ecom/user-guides/拆解与拉片工具怎么选.md", category: "functional", label: "拆解与拉片怎么选" },
  {
    path: "docs/ecom/user-guides/使用指南-电商产品主图创作.md",
    category: "functional",
    label: "电商产品主图创作",
  },
  {
    path: "docs/ecom/user-guides/使用指南-详情长图分屏创作.md",
    category: "functional",
    label: "详情长图分屏创作",
  },
  {
    path: "docs/ecom/user-guides/使用指南-AI商品套图.md",
    category: "functional",
    label: "AI 商品套图",
  },
  {
    path: "docs/ecom/user-guides/使用指南-A+详情模块出图.md",
    category: "functional",
    label: "A+ 详情模块出图",
  },
  {
    path: "docs/ecom/user-guides/使用指南-服装详情套图（模板）.md",
    category: "functional",
    label: "服装详情套图模板",
  },
  {
    path: "docs/ecom/user-guides/使用指南-参考详情转标准套图.md",
    category: "functional",
    label: "参考详情转标准套图",
  },
  {
    path: "docs/ecom/user-guides/使用指南-学竞品结构原创详情.md",
    category: "functional",
    label: "学竞品结构原创详情",
  },
  {
    path: "docs/ecom/user-guides/使用指南-拆图拆视频.md",
    category: "functional",
    label: "拆图拆视频",
  },
  {
    path: "docs/ecom/user-guides/使用指南-专业拉片.md",
    category: "functional",
    label: "专业拉片",
  },
  {
    path: "docs/ecom/user-guides/使用指南-电商口播故事版.md",
    category: "functional",
    label: "电商口播故事版",
  },
  { path: "docs/种草视频-使用指南.md", category: "functional", label: "种草视频" },
  { path: "docs/穿搭视频.md", category: "functional", label: "穿搭视频" },
  { path: "docs/自动剪辑.md", category: "functional", label: "自动剪辑与成片" },

  // —— 一键复刻 · 工具站 · 常用工具 · 其它应用 ——
  { path: "docs/快速复制-使用指南-20261004.md", category: "functional", label: "一键复刻使用指南" },
  { path: "docs/quick-replica.md", category: "functional", label: "一键复刻说明" },
  { path: "docs/常用工具-使用指南-20261004.md", category: "functional", label: "常用工具使用指南" },
  { path: "docs/prompt-optimizer.md", category: "functional", label: "提示词优化器说明" },
  { path: "docs/director.md", category: "functional", label: "3D 导演台" },
  { path: "docs/一键发布平台.md", category: "functional", label: "一键发布" },
  { path: "docs/文生试衣.md", category: "functional", label: "AI 试衣与试衣间" },
  { path: "docs/图片处理-使用指南.md", category: "functional", label: "图片处理" },
];

/** 白名单路径集合（去重校验用） */
export const KNOWLEDGE_ALLOWLIST_PATHS = Array.from(
  new Set(KNOWLEDGE_ALLOWLIST.map((s) => s.path)),
);
