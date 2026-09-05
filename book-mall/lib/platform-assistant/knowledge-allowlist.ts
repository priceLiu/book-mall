/**
 * 平台 AI 导览助手 · 知识白名单。
 * 只有此清单中的文件会被切块入库；内部 plans / 财务 / 定价 / 计算规则一律不纳入。
 * 路径相对仓库根目录。
 */

export type KnowledgeCategory = "functional" | "operational" | "intro";

export type KnowledgeSource = {
  /** 相对仓库根路径 */
  path: string;
  category: KnowledgeCategory;
  /** 用于回答引用的可读名称 */
  label: string;
};

export const KNOWLEDGE_ALLOWLIST: KnowledgeSource[] = [
  // 权威应用清单（对外可讲，回答「平台有哪些应用 / 某应用是做什么的」以此为准）
  { path: "docs/platform-apps-catalog.md", category: "intro", label: "平台应用总览" },
  { path: "book-mall/doc/product/00-overview.md", category: "intro", label: "平台总览" },
  // 各应用功能与使用
  { path: "book-mall/doc/product/e-commerce-toolkit.md", category: "functional", label: "电商工具箱" },
  { path: "book-mall/doc/product/ecom-product-creation-workflow.md", category: "functional", label: "电商产品主图 / 详情页创作操作" },
  { path: "book-mall/doc/product/quick-replica-platform.md", category: "functional", label: "快速复制" },
  { path: "book-mall/doc/product/prompt-optimizer-platform.md", category: "functional", label: "提示词优化器" },
  { path: "book-mall/doc/product/08-independent-tools-sso.md", category: "operational", label: "工具站与登录互通" },
  { path: "book-mall/doc/product/04-user-center.md", category: "operational", label: "个人中心" },
  { path: "book-mall/doc/product/06-flows.md", category: "operational", label: "主要使用流程" },
  { path: "book-mall/doc/product/16-project-assets-unified-design.md", category: "functional", label: "项目资产" },
  // AI 画布
  { path: "docs/canvas.md", category: "functional", label: "AI 画布" },
  { path: "docs/新画布.md", category: "functional", label: "AI 画布新版" },
  { path: "canvas-web/docs/canvas-portal-product-requirements.md", category: "functional", label: "AI 画布门户" },
  // 漫剧 / 影视（Pro2 工作流等；不含 libtv 内部规格文件名）
  { path: "canvas-web/docs/story-editions-overview.md", category: "functional", label: "漫剧与影视版本总览" },
  { path: "canvas-web/docs/story-pro2-workflow-canonical.md", category: "functional", label: "影视专业版2.0工作流" },
  { path: "canvas-web/docs/story-pro2-design-spec.md", category: "functional", label: "影视专业版2.0设计" },
  { path: "canvas-web/docs/story-pro-edition-requirements.md", category: "functional", label: "影视专业版需求" },
  { path: "canvas-web/docs/story-pro-workflow-canonical.md", category: "functional", label: "影视专业版1.0工作流" },
  { path: "canvas-web/docs/story-pro-character-asset-workflow.md", category: "functional", label: "角色资产工作流" },
  { path: "canvas-web/docs/storyboard-video-1.0-requirements.md", category: "functional", label: "分镜视频需求" },
  { path: "canvas-web/docs/storyboard-video-1.0-workflow-canonical.md", category: "functional", label: "分镜视频工作流" },
  { path: "canvas-web/docs/plan-2.0.md", category: "functional", label: "影视2.0规划" },
  { path: "canvas-web/docs/ref-video-workflow.md", category: "functional", label: "参考视频工作流" },
  { path: "canvas-web/docs/3-view.md", category: "functional", label: "三视图" },
  { path: "canvas-web/docs/9-grid.md", category: "functional", label: "九宫格分镜" },
  { path: "canvas-web/docs/do-v2.md", category: "functional", label: "影视2.0实施" },
  { path: "canvas-web/docs/story-ops.md", category: "operational", label: "漫剧运营" },
  // 其它应用
  { path: "docs/ecom.md", category: "functional", label: "电商创作" },
  { path: "docs/director.md", category: "functional", label: "3D 导演台" },
  { path: "docs/quick-replica.md", category: "functional", label: "快速复制说明" },
  { path: "docs/一键发布平台.md", category: "functional", label: "一键发布" },
  { path: "docs/自动剪辑.md", category: "functional", label: "自动剪辑" },
];
