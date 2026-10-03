export type PosterFestivalPack = {
  id: string;
  label: string;
  promptHint: string;
  copyTone: string;
  defaultTitle: string;
};

export const POSTER_FESTIVAL_PACKS: PosterFestivalPack[] = [
  {
    id: "618",
    label: "618 大促",
    promptHint: "电商大促氛围，红橙主色，礼盒与折扣视觉元素，商业摄影光",
    copyTone: "限时直降、爆款秒杀",
    defaultTitle: "618 狂欢购",
  },
  {
    id: "double11",
    label: "双 11",
    promptHint: "双十一购物节，高能量促销视觉，霓虹与礼盒，留标题留白",
    copyTone: "全年最低价",
    defaultTitle: "双 11 开抢",
  },
  {
    id: "spring-festival",
    label: "春节",
    promptHint: "新春喜庆氛围，红金配色，灯笼祥云元素，无文字",
    copyTone: "新春特惠",
    defaultTitle: "新春大吉",
  },
  {
    id: "new-arrival",
    label: "日常上新",
    promptHint: "简约电商上新，明亮棚拍或生活方式场景，留白给标题",
    copyTone: "新品首发",
    defaultTitle: "新品上市",
  },
  {
    id: "live-preview",
    label: "直播预告",
    promptHint: "直播间预告氛围，竖构图友好，聚光灯与产品主体",
    copyTone: "今晚开播",
    defaultTitle: "直播预告",
  },
  {
    id: "clearance",
    label: "清仓",
    promptHint: "清仓促销，强对比色块与价格感留白，无具体数字",
    copyTone: "限时清仓",
    defaultTitle: "清仓甩卖",
  },
];

export function getPosterFestivalPack(id: string | undefined): PosterFestivalPack | undefined {
  const t = id?.trim();
  if (!t) return undefined;
  return POSTER_FESTIVAL_PACKS.find((p) => p.id === t);
}
