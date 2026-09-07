/** 故事剧场选题库 · 平台种子（docs/故事版*提示词 库.md） */

export type StoryTheaterTopicSeed = {
  id: string;
  vertical: "fashion_apparel" | "bags" | "digital_3c";
  title: string;
  storyCore: string;
  storyType: string;
  tags: string[];
  sortOrder: number;
};

export const STORY_THEATER_TOPIC_SEED: StoryTheaterTopicSeed[] = [
  {
    id: "st-fashion-01",
    vertical: "fashion_apparel",
    title: "出门前对着镜子穿搭焦虑",
    storyCore:
      "女生出门前站在镜子前，对自己现有穿搭不满意、身材焦虑，换上新衣服之后变得自信满意。",
    storyType: "痛点治愈",
    tags: ["身材焦虑", "出门前", "镜子", "显瘦"],
    sortOrder: 1,
  },
  {
    id: "st-fashion-02",
    vertical: "fashion_apparel",
    title: "通勤一整天衣服紧绷不舒服",
    storyCore:
      "日常上班通勤，身上衣服紧绷拘束、活动不方便，换上这件服装之后舒适放松，一整天状态很好。",
    storyType: "场景适配",
    tags: ["通勤", "久坐", "舒适", "上班族"],
    sortOrder: 2,
  },
  {
    id: "st-fashion-03",
    vertical: "fashion_apparel",
    title: "聚会拍照穿搭不上镜",
    storyCore:
      "准备朋友聚会，试了好几套衣服拍照都不好看，换上本品之后版型显瘦上镜，氛围感拉满。",
    storyType: "场景适配",
    tags: ["聚会", "拍照", "上镜", "氛围感"],
    sortOrder: 3,
  },
  {
    id: "st-fashion-04",
    vertical: "fashion_apparel",
    title: "之前买同款衣服频频踩坑",
    storyCore:
      "之前多次买同类衣服踩坑，版型差、面料不好，本来不抱期待，试穿这件之后超出预期。",
    storyType: "经验避坑",
    tags: ["踩坑", "网购翻车", "对比", "谨慎种草"],
    sortOrder: 4,
  },
  {
    id: "st-fashion-05",
    vertical: "fashion_apparel",
    title: "旧衣服显臃肿没有气质",
    storyCore:
      "一直穿宽松旧衣服显得臃肿没精神，换上新款之后身形利落，整个人气质明显提升。",
    storyType: "前后反差",
    tags: ["气质提升", "新旧对比", "显瘦", "日常"],
    sortOrder: 5,
  },
  {
    id: "st-fashion-06",
    vertical: "fashion_apparel",
    title: "周末出游纠结穿搭不好搭配",
    storyCore:
      "周末计划外出游玩，翻遍衣柜找不到合适穿搭，试穿这件衣服之后百搭好看，适合出行。",
    storyType: "场景适配",
    tags: ["出游", "周末", "百搭", "户外"],
    sortOrder: 6,
  },
  {
    id: "st-fashion-07",
    vertical: "fashion_apparel",
    title: "胯宽腿粗很难买到合适下装",
    storyCore:
      "一直被胯宽腿粗困扰，很难买到合身裤子/半身裙，上身这件完美修饰身材，解决长期烦恼。",
    storyType: "痛点治愈",
    tags: ["梨形身材", "胯宽", "腿粗", "修饰身形"],
    sortOrder: 7,
  },
  {
    id: "st-fashion-08",
    vertical: "fashion_apparel",
    title: "临时约会来不及精心搭配",
    storyCore:
      "临时收到约会邀约，时间紧张来不及搭配，随手穿上这件衣服，效果意外好看。",
    storyType: "场景适配",
    tags: ["临时约会", "懒人穿搭", "应急", "精致感"],
    sortOrder: 8,
  },
  {
    id: "st-fashion-09",
    vertical: "fashion_apparel",
    title: "穿紧身衣服身上有明显赘肉",
    storyCore:
      "穿紧身衣物容易暴露腰腹赘肉，很不自信，这件版型能够巧妙遮挡，自在不紧绷。",
    storyType: "痛点治愈",
    tags: ["腰腹赘肉", "遮肉", "不紧绷", "自信"],
    sortOrder: 9,
  },
  {
    id: "st-fashion-10",
    vertical: "fashion_apparel",
    title: "网购衣服经常货不对版",
    storyCore:
      "网上买衣服经常实物和图片差距大，抱着试一试心态入手这件，上身效果和宣传一致很惊喜。",
    storyType: "经验避坑",
    tags: ["网购踩坑", "货不对版", "真实上身", "惊喜"],
    sortOrder: 10,
  },
  {
    id: "st-bags-01",
    vertical: "bags",
    title: "出门背包总觉得和穿搭不搭",
    storyCore:
      "女生准备出门，试了好几个旧包包，和今天穿搭风格格格不入，换上新包之后整体搭配协调，氛围感立刻出来。",
    storyType: "痛点治愈",
    tags: ["穿搭搭配", "出门", "风格违和", "氛围感", "女包"],
    sortOrder: 1,
  },
  {
    id: "st-bags-02",
    vertical: "bags",
    title: "通勤包包东西一多就乱糟糟",
    storyCore:
      "日常上班通勤，旧包没有分层，钥匙、耳机、文件混在一起不好找，换上这款分区合理的包，收纳整齐拿取方便。",
    storyType: "场景适配",
    tags: ["通勤", "收纳", "分层", "上班族", "大容量包"],
    sortOrder: 2,
  },
  {
    id: "st-bags-03",
    vertical: "bags",
    title: "聚会场合包包显得廉价不上档次",
    storyCore:
      "准备赴朋友聚会，翻出旧包包，质感普通不上镜，背上新款包包之后气质提升，拍照很好看。",
    storyType: "场景适配",
    tags: ["聚会", "质感", "拍照上镜", "精致", "晚宴包"],
    sortOrder: 3,
  },
  {
    id: "st-bags-04",
    vertical: "bags",
    title: "之前买包频繁踩坑容易变形掉皮",
    storyCore:
      "之前网购多款包包，用没多久皮质开裂变形，本来不敢再买，入手这款之后做工扎实耐用超出预期。",
    storyType: "经验避坑",
    tags: ["踩坑", "皮质差", "变形", "耐用", "种草"],
    sortOrder: 4,
  },
  {
    id: "st-bags-05",
    vertical: "bags",
    title: "旧包版型臃肿显累赘",
    storyCore:
      "一直背旧大包，版型臃肿显笨重，换上新款简约包包，身形看着利落轻便。",
    storyType: "前后反差",
    tags: ["版型臃肿", "轻便", "简约", "日常通勤包"],
    sortOrder: 5,
  },
  {
    id: "st-bags-06",
    vertical: "bags",
    title: "周末出游背包太重肩颈酸痛",
    storyCore:
      "周末外出游玩，旧背包自重很重，背久肩膀酸痛，换上这款轻量化包包，出门轻松无负担。",
    storyType: "场景适配",
    tags: ["出游", "轻量化", "肩痛", "短途出行", "休闲包"],
    sortOrder: 6,
  },
  {
    id: "st-bags-07",
    vertical: "bags",
    title: "小包好看但是装不下随身必需品",
    storyCore:
      "喜欢精致小包但是容量太小，手机、补妆品放不下，这款兼顾小巧外观和实用空间，颜值够用。",
    storyType: "痛点治愈",
    tags: ["容量矛盾", "精致小包", "日常随身", "兼顾颜值实用"],
    sortOrder: 7,
  },
  {
    id: "st-bags-08",
    vertical: "bags",
    title: "临时约会找不到合适的包包",
    storyCore:
      "临时收到约会邀约，匆忙翻包没有适配的款式，随手背上这款包包，风格温柔很适配场景。",
    storyType: "场景适配",
    tags: ["临时约会", "应急搭配", "精致小包", "氛围感"],
    sortOrder: 8,
  },
  {
    id: "st-bags-09",
    vertical: "bags",
    title: "包带太短背起来很别扭",
    storyCore:
      "旧包包肩带长度固定，单肩斜挎都不舒服，这款肩带可调节，各种背法都自然舒适。",
    storyType: "痛点治愈",
    tags: ["肩带", "可调节", "斜挎包", "舒适"],
    sortOrder: 9,
  },
  {
    id: "st-bags-10",
    vertical: "bags",
    title: "网购包包图片好看实物货不对板",
    storyCore:
      "网上买包经常图片好看实物廉价，抱着试一试心态下单这款，到手质感和宣传一致很惊喜。",
    storyType: "经验避坑",
    tags: ["网购踩坑", "货不对版", "实物测评", "包包"],
    sortOrder: 10,
  },
  {
    id: "st-3c-01",
    vertical: "digital_3c",
    title: "出门手机电量焦虑总担心没电",
    storyCore:
      "外出办事手机电量掉得很快，一直担心关机，带上这款充电宝之后随时补电，不再电量焦虑。",
    storyType: "痛点治愈",
    tags: ["电量焦虑", "出门续航", "充电宝", "便携数码"],
    sortOrder: 1,
  },
  {
    id: "st-3c-02",
    vertical: "digital_3c",
    title: "办公室耳机嘈杂没法专心工作",
    storyCore:
      "办公室环境嘈杂，外界杂音不断难以集中注意力，戴上这款降噪耳机之后环境安静，可以专注做事。",
    storyType: "场景适配",
    tags: ["办公", "降噪耳机", "专注", "环境嘈杂"],
    sortOrder: 2,
  },
  {
    id: "st-3c-03",
    vertical: "digital_3c",
    title: "外出拍摄画面抖动视频很糊",
    storyCore:
      "出门随手拍视频画面一直抖动，成片模糊，用上这款稳定设备之后画面平稳流畅。",
    storyType: "场景适配",
    tags: ["拍摄防抖", "短视频", "手持设备", "户外"],
    sortOrder: 3,
  },
  {
    id: "st-3c-04",
    vertical: "digital_3c",
    title: "之前买平价数码产品频繁故障",
    storyCore:
      "之前贪便宜买数码配件，经常失灵损坏，这次入手这款品质稳定，日常使用很省心。",
    storyType: "经验避坑",
    tags: ["平价踩坑", "数码配件", "稳定耐用", "避坑"],
    sortOrder: 4,
  },
  {
    id: "st-3c-05",
    vertical: "digital_3c",
    title: "旧充电器体积大出门携带麻烦",
    storyCore:
      "原装充电器体积大占地方，背包不好收纳，换上这款小巧快充，随身携带不占地。",
    storyType: "前后反差",
    tags: ["便携充电器", "小巧", "快充", "出差通勤"],
    sortOrder: 5,
  },
  {
    id: "st-3c-06",
    vertical: "digital_3c",
    title: "周末户外信号差通话断断续续",
    storyCore:
      "周末去郊外，蓝牙设备信号不稳定频繁断连，换上这款低延迟设备，连接稳定不断开。",
    storyType: "场景适配",
    tags: ["户外蓝牙", "断连", "低延迟", "周末出行"],
    sortOrder: 6,
  },
  {
    id: "st-3c-07",
    vertical: "digital_3c",
    title: "键盘按键生硬长时间打字手酸",
    storyCore:
      "旧键盘按键偏硬，长时间打字手腕酸痛，换上这款手感柔和的键盘，办公轻松很多。",
    storyType: "痛点治愈",
    tags: ["办公键盘", "手感", "打字疲劳", "久坐办公"],
    sortOrder: 7,
  },
  {
    id: "st-3c-08",
    vertical: "digital_3c",
    title: "临时出门开会缺少录音设备",
    storyCore:
      "临时开会来不及记录内容，手忙脚乱，用这款录音设备清晰收录讲话内容，会后方便整理。",
    storyType: "场景适配",
    tags: ["会议录音", "应急", "办公数码", "记录"],
    sortOrder: 8,
  },
  {
    id: "st-3c-09",
    vertical: "digital_3c",
    title: "线材杂乱桌面乱糟糟",
    storyCore:
      "桌面数据线一大堆缠绕打结，收拾麻烦，用理线配件之后桌面整洁清爽。",
    storyType: "痛点治愈",
    tags: ["桌面理线", "线材杂乱", "办公收纳", "数码配件"],
    sortOrder: 9,
  },
  {
    id: "st-3c-10",
    vertical: "digital_3c",
    title: "数码产品宣传参数好看实际拉胯",
    storyCore:
      "很多数码产品参数很漂亮，实际使用体验差，这款实测表现和宣传一致，超出预期。",
    storyType: "经验避坑",
    tags: ["参数虚标", "实测", "数码测评", "避坑"],
    sortOrder: 10,
  },
];
