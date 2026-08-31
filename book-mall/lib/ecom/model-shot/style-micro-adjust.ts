type StyleKey =
  | "酷冷"
  | "活泼"
  | "夸张"
  | "优雅"
  | "慵懒"
  | "自信"
  | "性感"
  | "邻家";

const REPLACEMENTS: Record<
  StyleKey,
  { hands: string; legs: string; head: string; torso: string }
> = {
  酷冷: {
    hands: "插兜或拎包自然垂落",
    legs: "重心压在后腿，双腿交叉或一脚前点地",
    head: "下巴微抬，眼神侧视或平视不笑",
    torso: "肩颈挺拔，躯干大幅度侧转约30~45°",
  },
  活泼: {
    hands: "双手向外张开或轻触头发",
    legs: "双腿大幅度错开，微微跳跃离地",
    head: "正对镜头，歪头，咧嘴露齿笑",
    torso: "身体轻微前倾，动态扭转感强",
  },
  夸张: {
    hands: "双臂极度张开或双手抱头后拉",
    legs: "弓步压到最低或高抬腿",
    head: "头部大角度侧倾，猛然回眸",
    torso: "躯干旋转超过45°，身体极度延展",
  },
  优雅: {
    hands: "手指轻贴脸颊或手肘微曲自然垂放",
    legs: "双腿并拢或小幅度前后错开，重心稳定",
    head: "微笑含蓄，视线平视或微低",
    torso: "躯干轻微侧转约15°，姿态端正挺拔",
  },
  慵懒: {
    hands: "手臂耷拉垂在身侧或随意搭在腰间",
    legs: "重心全压在一条腿上，另一腿弯曲点地",
    head: "眼神迷离，低头看向地面",
    torso: "脊柱不绷直，松垮站立",
  },
  自信: {
    hands: "单手或双手叉腰，或拎包甩到身后",
    legs: "双腿分开与肩同宽，重心居中且稳定",
    head: "正视镜头，下巴微扬，目光坚定",
    torso: "正面或微侧，胸腔主动打开",
  },
  性感: {
    hands: "指尖轻触锁骨或手指穿过发丝",
    legs: "单腿微曲，重心落在另一腿上",
    head: "眼神迷离深邃，视线从下往上看镜头",
    torso: "脊柱呈S型曲线，肩胛骨后收",
  },
  邻家: {
    hands: "双手自然交叠身前或扶包带",
    legs: "双腿自然并拢或小步错开",
    head: "温暖微笑，正对镜头或微低看道具",
    torso: "身体放松正对或微侧，姿态不刻意",
  },
};

export function applyStyleMicroAdjust(baseDescription: string, style: StyleKey): string {
  const r = REPLACEMENTS[style];
  return `${baseDescription}。手部：${r.hands}；腿部：${r.legs}；头部：${r.head}；躯干：${r.torso}。`;
}
