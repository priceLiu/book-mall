export type FittingRoomLocale = "zh" | "en";

export const fittingRoomMessages = {
  zh: {
    pageTitle: "试衣间",
    pageSubtitle:
      "浏览套装穿搭风格，点击查看单品轮播；购买将跳转亚马逊（新标签页）。",

    loadingSession: "正在同步会话…",

    noTokenLead:
      "未检测到工具站会话（tools_token）。请在主站登录后使用下方链接重新进入（未登录会先经过主站登录页）。",
    noTokenOriginHint:
      "若刚从主站点开却仍提示此项：请确认浏览器地址与主站配置的 TOOLS_PUBLIC_ORIGIN 完全一致（例如勿混用 localhost 与 127.0.0.1）。详见 tool-web/doc/tech/sso-session-troubleshooting.md。",
    reconnectFitting: "从主站重新连接工具站（试衣间）",
    accountHintPrefix: "亦可：",
    account: "个人中心",
    admin: "管理后台",
    accountHintSuffix: "（在其中点击「打开试衣间 / 工具站」）。",

    missingMainOrigin:
      "请在本站 .env.local 配置 MAIN_SITE_ORIGIN 指向运行中的主站。",

    tokenInvalidLead: "工具站令牌无效或已过期，或主站侧已不再满足准入。",
    retrySync: "再试一次同步",
    reconnectShort: "从主站重新连接",

    filterGroupAria: "按穿搭性别筛选",
    filterAllAria: "全部穿搭",
    filterMaleAria: "男士穿搭",
    filterFemaleAria: "女士穿搭",

    localeSwitchAria: "切换界面语言",
    localeZh: "中文",
    localeEn: "English",

    galleryTitle: "套装列表",
    galleryEmpty: "当前筛选下暂无套装。",
    galleryNoData: "未加载到套装数据，请确认 mock/data.json 是否存在且为数组。",
    outfitCardAlt: "套装预览图",

    modalCloseAria: "关闭",
    carouselPrevAria: "上一张",
    carouselNextAria: "下一张",
    carouselSlideAlt: "单品图片",

    pieceTop: "上装",
    pieceBottom: "下装",
    pieceOther: "单品",

    buyOnAmazon: "购买",
    tryOn: "试穿",
  },
  en: {
    pageTitle: "Fitting room",
    pageSubtitle:
      "Browse outfit styles and open a card for the garment carousel. Purchases open Amazon in a new tab.",

    loadingSession: "Syncing session…",

    noTokenLead:
      "No tool-site session (tools_token). Sign in on the main site, then use the link below to enter again.",
    noTokenOriginHint:
      "If you came from the main site but still see this: make sure the browser origin matches TOOLS_PUBLIC_ORIGIN (do not mix localhost and 127.0.0.1). See tool-web/doc/tech/sso-session-troubleshooting.md.",
    reconnectFitting: "Reconnect from main site (fitting room)",
    accountHintPrefix: "You can also open ",
    account: "Account",
    admin: "Admin",
    accountHintSuffix: " (then launch the tool site from there).",

    missingMainOrigin:
      "Set MAIN_SITE_ORIGIN in .env.local to your running main-site URL.",

    tokenInvalidLead:
      "Tool token is invalid or expired, or you no longer meet access rules on the main site.",
    retrySync: "Try syncing again",
    reconnectShort: "Reconnect from main site",

    filterGroupAria: "Filter outfits by gender",
    filterAllAria: "All outfits",
    filterMaleAria: "Men’s outfits",
    filterFemaleAria: "Women’s outfits",

    localeSwitchAria: "Switch language",
    localeZh: "中文",
    localeEn: "English",

    galleryTitle: "Outfits",
    galleryEmpty: "No outfits match this filter.",
    galleryNoData: "No outfit data loaded. Check that mock/data.json exists and is an array.",
    outfitCardAlt: "Outfit preview",

    modalCloseAria: "Close",
    carouselPrevAria: "Previous",
    carouselNextAria: "Next",
    carouselSlideAlt: "Garment image",

    pieceTop: "Top",
    pieceBottom: "Bottom",
    pieceOther: "Item",

    buyOnAmazon: "Buy",
    tryOn: "Try on",
  },
} as const;

export type FittingRoomMsgKey = keyof typeof fittingRoomMessages.zh;
