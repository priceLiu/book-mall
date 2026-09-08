import type { MediaDecomposeKind } from "@/lib/ecom/ecom-media-decompose-types";
import {
  mediaDecomposePatchSchema,
  type MediaDecomposePatch,
} from "@/lib/ecom/ecom-media-decompose-structured";

/** Dev mock · 视频拆解（3 镜，供复刻脚本匹配） */
export const MOCK_MEDIA_DECOMPOSE_VIDEO_PATCH: MediaDecomposePatch = {
  mediaType: "video",
  action: "decompose_complete",
  visualStyle: "清新带货 lookbook，低饱和莫兰迪",
  globalColorTone: "暖金侧光，奶油白与浅灰背景",
  cameraLanguageSummary: "镜1固定；镜2慢推；镜3横移跟拍",
  scenePrep: {
    venue: "简约室内摄影棚",
    fixedProps: "展示台、绿植",
  },
  openingHook: {
    firstFrame: "中景：模特面向镜头举产品，左上角大字「夏季必备」",
    first3sLines: "这件真的太好穿了",
  },
  fullTranscript: "这件真的太好穿了面料轻薄透气，上身无负担通勤出游都能搭",
  talentAnalysis: {
    count: "1 位女性模特，全片同一人",
    appearance: "约 25 岁，长直发，自然淡妆，偏瘦高",
    expressionStyle: "对镜微笑，讲解时眼神看镜头",
    blocking: "棚内站姿展示，中段转身走两步",
  },
  wardrobeAnalysis: {
    garments: "米白针织开衫 + 浅色阔腿裤，无配饰",
    changes: "全片同一套",
    stylingNotes: "突出面料垂感与领口层次，适合 lookbook 复刻",
  },
  narrativeLogic:
    "【Mock】五段式：0–3s 钩子展示产品 → 3–8s 卖点讲解 → 8–12s 使用演示 → 12–15s 社会证明 → 15–18s CTA。",
  beatPoints: "【Mock】0s 硬切开场；3s BGM 起；8s 特写产品；12s 转场至用户评价；15s 口播 CTA。",
  replicableShootingScript:
    "【Mock】机位：主机位三脚架 + 侧面 45° 辅机位；灯光：柔光主灯 + 轮廓光；按镜序逐条拍摄，产品 @图片2 替换原片 SKU。",
  storyboardTable: [
    {
      shotNo: 1,
      duration: "0-3s",
      shotSize: "中景",
      cameraMove: "固定",
      cameraAngle: "平视",
      composition: "三分法",
      lightingSetup: "柔光主灯 45° 侧顺光",
      toneContrast: "低对比自然光",
      visualContent: "模特手持产品面向镜头微笑",
      characterAction: "单手举起产品展示",
      expression: "自然微笑",
      subtitle: "夏季必备",
      voiceover: "这件真的太好穿了",
      sfx: "环境音",
      bgm: "轻快 BGM",
      transition: "硬切",
      editRhythm: "快节奏",
    },
    {
      shotNo: 2,
      duration: "3-8s",
      shotSize: "特写",
      cameraMove: "慢推",
      cameraAngle: "俯拍",
      composition: "中心构图",
      lightingSetup: "顶光+柔光补光",
      toneContrast: "特写高清晰度，中性色温",
      visualContent: "产品面料与做工细节",
      characterAction: "手指划过面料",
      expression: "—",
      subtitle: "透气亲肤",
      voiceover: "面料轻薄透气，上身无负担",
      sfx: "摩擦音",
      bgm: "延续",
      transition: "叠化",
      editRhythm: "中速",
    },
    {
      shotNo: 3,
      duration: "8-12s",
      shotSize: "全景",
      cameraMove: "跟拍",
      cameraAngle: "平视",
      composition: "引导线",
      lightingSetup: "侧顺光，环境补光",
      toneContrast: "暖调中等对比",
      visualContent: "模特转身展示穿搭效果",
      characterAction: "转身走两步",
      expression: "自信",
      subtitle: "多场景可穿",
      voiceover: "通勤出游都能搭",
      sfx: "脚步",
      bgm: "高潮",
      transition: "硬切",
      editRhythm: "快节奏",
    },
  ],
};

/** Dev mock · 产品识图 brief */
export const MOCK_REPLICA_PRODUCT_BRIEF = [
  "产品：【Mock】休闲针织开衫",
  "品类：女装 / 针织外套",
  "材质/工艺：棉混纺针织，哑光质地",
  "展示建议：半身或全身 lookbook，突出面料垂感",
].join("\n");

export const MOCK_REPLICA_SELLING_POINTS = "轻薄透气、莫兰迪配色、通勤百搭";

export const MOCK_MEDIA_DECOMPOSE_IMAGE_PATCH: MediaDecomposePatch = {
  mediaType: "image",
  action: "decompose_complete",
  elements: {
    subject: "【Mock】年轻女性模特，休闲穿搭",
    subjectPose: "自然站立，一手插袋",
    sceneEnvironment: "简约室内，浅灰背景墙",
    spatialPerspective: "平视，全身",
    composition: "居中，留白上方",
    equivalentFocalLength: "50mm",
    shootingAngle: "略低机位",
    lighting: {
      keyLight: "柔光箱 45°",
      fillLight: "反光板",
      rimLight: "轮廓光",
      ambientLight: "环境补光",
      direction: "左前方",
      hardSoft: "软光",
      colorTemperature: "5500K",
    },
    materialTexture: "棉质针织，哑光",
    colorSystem: "低饱和莫兰迪",
    atmosphere: "清新、带货 lookbook",
    detailNotes: "适合替换为 @图片2 产品展示",
  },
  positivePrompt:
    "【Mock】Full-body fashion lookbook, young woman, casual outfit, soft studio light, clean background, e-commerce style, 3:4 vertical",
  negativePrompt: "blurry, watermark, text, logo, deformed hands",
  liveActionReplication: {
    sceneSetup:
      "选址江南老巷石板路：保留两侧粉墙与深色木窗，提前清理地面杂物；左侧挂 2～3 条浅色晾晒床单作纵深引导，右侧留 1.2m 通行缝；拍摄前 30 分钟踩点确认无现代招牌入画，必要时黑布遮挡。",
    talentBlocking:
      "两名 8～12 岁男童：A 穿红色 Polo + 深蓝短裤站画面左前 1/3，B 穿白 T + 灰裤在右后形成三角构图；A 微侧向 B，自然对视或共视远方，表情松弛不摆拍；禁止遮挡彼此面部与背景晾衣线条。",
    compositionFraming:
      "中景偏全身，三角构图：前景 A、中景 B、背景晾衣与巷道透视线；机位低角度 1.4m 平视略仰，40mm 等效，主体占画面高度约 60%，顶部留 10% 天空/墙檐，底部石板路占 15%。",
    cameraPlacement:
      "主机位三脚架：距主体约 3.6m，镜头高度 1.4m（与儿童眼平），略仰 5°；相机与巷道中轴偏左 0.5m，避免对称呆板；辅机位可选 45° 侧位仅作 B-roll，本方案以主机位为准。",
    lightingSetup:
      "阴天漫射自然光为主：无需闪光灯；若反差不足，在相机左侧 2m 处加 1.2×1.2m 白反光板补面；避免硬阴影；轮廓光来自环境，不强补；色温约 5500K 日光，保持胶片低饱和。",
    props:
      "服装：A 红色 Polo、深蓝短裤；B 白 T、灰长裤；环境：石板路、粉墙、深色木窗、2～3 条浅色床单；禁止现代塑料玩具、运动鞋 logo 特写入画。",
    cameraParams:
      "全画幅等效 40mm，f/8，1/500s，ISO 400；手动白平衡日光；RAW 拍摄；可参考 Kodak Gold 200 / Portra 400 颗粒与肤色倾向。",
    postProcessing:
      "Lightroom：降饱和 10～15%，略提阴影、压高光；加轻微胶片颗粒；HSL 中红色略降饱和避免 Polo 过艳；输出 3:2 或 4:5 电商竖图时保留头顶与脚部裁切安全区。",
    shootingChecklist:
      "1. 踩点确认巷道光线与杂物\n2. 挂床单、清地面、遮挡现代元素\n3. 儿童换装与站位 rehearsal\n4. 测曝光（灰卡/人脸）\n5. 主机位连拍 20+ 张选表情\n6. 回看焦点与构图三角\n7. 导入 RAW 调色导出交付",
  },
};

export function mockMediaDecomposePatchForKind(kind: MediaDecomposeKind): MediaDecomposePatch {
  return kind === "video" ? MOCK_MEDIA_DECOMPOSE_VIDEO_PATCH : MOCK_MEDIA_DECOMPOSE_IMAGE_PATCH;
}

/** 启动时校验 fixture 与 schema 一致 */
export function assertMockMediaDecomposeFixturesValid(): void {
  mediaDecomposePatchSchema.parse(MOCK_MEDIA_DECOMPOSE_VIDEO_PATCH);
  mediaDecomposePatchSchema.parse(MOCK_MEDIA_DECOMPOSE_IMAGE_PATCH);
}

assertMockMediaDecomposeFixturesValid();
