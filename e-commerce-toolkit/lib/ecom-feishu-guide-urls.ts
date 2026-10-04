/**
 * 飞书知识库 · 使用指南链接（SSOT：docs/飞书文档链接.md）
 * 产品内链 docx；总目录用 wiki 节点。
 */

import { ECOM_MODULES, findModuleByHref } from "@/lib/modules/registry";

const FEISHU_DOC = "https://feishu.doubao.com/docx";

/** 电商工具箱知识库根（目录） */
export const ECOM_FEISHU_GUIDE_WIKI_HUB =
  "https://feishu.doubao.com/wiki/YM4iwdpf9iVwFnkPiG5cxLnpnEh";

function doc(token: string): string {
  return `${FEISHU_DOC}/${token}`;
}

/** 按 `ECOM_MODULES` 的 module id */
export const ECOM_FEISHU_GUIDE_BY_MODULE_ID: Readonly<Record<string, string>> = {
  "product-creation": doc("RRhTdjjQIoluz7x245HcBUSUnAf"),
  "product-image-set": doc("J8QpdLhqEoZoNbx28cIcfhxmnfd"),
  "ai-detail-page": doc("IQr3dws2wopSRPxXpWKcFqU6n1c"),
  "detail-page-creation": doc("QrBrd0GkIoqfRJxTD1CcjkMUnkf"),
  "detail-page-suite": doc("AEAVdnffOo8tuoxwBtCchWgWn1g"),
  "detail-page-suite-replica": doc("GB9bdiJ3ooNKIDxct2Rcfgv6nGg"),
  "detail-page-suite-hit": doc("KwmDdFzDaokrMFxMtCVcb9KdnHc"),
  "media-decompose": doc("KA3oduxTxoUTkvxBVr0cVdw6nGd"),
  "film-pull": doc("WUyRdkRTboqAJnxSkLJcc4ganhb"),
  "image-layer": doc("PBULdWaSGoRSnBxHz0PcmA8Znxg"),
  "video-camera": doc("GkamdMfHdoLZIxxKzAWcP5pdnfg"),
  "video-mirror-selfie": doc("GlySdGZe3orBqHxfx5Uc1wThnLf"),
  "video-dance-swap": doc("KvsodRbbCojGhjxBRyYcjMRjn9d"),
  "seed-video": doc("TFX1dUZZRonjS7xGCAwc013RnlO"),
  "storyboard-micro-drama": doc("QwG1d9htJoqSxixyWuicDRSqnmb"),
  ip: doc("M5Q6dhMbjoHsj9xoFqncceyUn6e"),
  poster: doc("DVx5dYlkXodP0kxCkZIcm9ZAnJc"),
  vi: doc("N0T5dELGyodeL8xRwuEciqsKnKR"),
  "hand-craft": doc("WlqwdeOVUoZPDZxSFsDcLOZrnxh"),
};

/** 侧栏分组小标题 ·「怎么选」类指南 */
export const ECOM_FEISHU_GUIDE_BY_NAV_SUBHEADING: Readonly<
  Record<string, string>
> = {
  主图与套图: doc("NL0ldgWx7owqaqxAn5YcPE51nFf"),
  详情页: doc("UeYzdfEd3orqevx1zHXcLz09npf"),
  拆解与拉片: doc("ZM3Ddgo2NoK1WBxpdD4cZx9UnY5"),
};

export function feishuGuideUrlForModuleId(moduleId: string): string | undefined {
  return ECOM_FEISHU_GUIDE_BY_MODULE_ID[moduleId];
}

export function feishuGuideUrlForPathname(pathname: string): string | undefined {
  const path = pathname.split("?")[0]?.replace(/\/$/, "") || "/";

  const exact = findModuleByHref(path);
  if (exact) return feishuGuideUrlForModuleId(exact.id);

  const sorted = [...ECOM_MODULES].sort(
    (a, b) => b.href.length - a.href.length,
  );
  for (const m of sorted) {
    if (m.href !== "/" && path.startsWith(m.href)) {
      const url = feishuGuideUrlForModuleId(m.id);
      if (url) return url;
    }
  }
  return undefined;
}
