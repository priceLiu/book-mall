/**
 * canvas v2 · 文本节点常用模板
 *
 * 用户在 text-node 点「+ 插入模板」时，从 popover 选择并插入到光标位置。
 */

export type CanvasTextTemplate = {
  id: string;
  name: string;
  hint: string;
  body: string;
};

export const CANVAS_TEXT_TEMPLATES: CanvasTextTemplate[] = [
  {
    id: "product-params",
    name: "产品参数",
    hint: "品牌 / 名称 / 规格 / 价格 / 卖点",
    body: `品牌：
名称：
规格：
价格：
卖点：`,
  },
  {
    id: "brand",
    name: "品牌信息",
    hint: "品牌定位 / 视觉色 / 风格",
    body: `品牌名称：
品牌定位：
主视觉色：
副视觉色：
品牌调性（关键词）：`,
  },
  {
    id: "style-keywords",
    name: "风格关键词",
    hint: "极简 / 复古 / 赛博 / 国潮 / ...",
    body: `主风格：极简
辅风格：现代
质感：哑光
色温：暖
情绪：高级、克制`,
  },
  {
    id: "audience",
    name: "受众画像",
    hint: "年龄 / 性别 / 圈层 / 偏好",
    body: `主受众年龄：
主受众性别：
圈层 / 兴趣：
关键购买理由：
忌讳元素：`,
  },
  {
    id: "design-spec",
    name: "设计规格",
    hint: "用途 / 尺寸 / 留白 / 文字层级",
    body: `用途场景：
画幅尺寸：
主视觉位置：
留白比例：
文字层级（标题 / 副标 / 正文）：`,
  },
];

/**
 * 给 NodePalette 新建节点时用：返回 preset 对应的 text 节点初始 data。
 * 没匹配到模板就返回 undefined（让上层用 NODE_DEFAULT_DATA）。
 */
export function buildTextNodeDataFromPreset(
  presetId: string,
): Record<string, unknown> | undefined {
  const tpl = CANVAS_TEXT_TEMPLATES.find((t) => t.id === presetId);
  if (!tpl) return undefined;
  return { text: tpl.body, mode: "manual" };
}
