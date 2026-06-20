/**
 * QuickReplica · kind 注册表（与 product doc §4.2 一致）
 */
import type { QrCategory } from "@/lib/quick-replica/qr-types";

export type QrKindDef = {
  id: string;
  label: string;
  labelEn?: string;
  description?: string;
  toolKey?: string;
};

export const QR_KINDS_BY_CATEGORY: Record<QrCategory, QrKindDef[]> = {
  video: [
    { id: "frame-to-video", label: "帧到视频", labelEn: "Frame to Video" },
    { id: "text-to-video", label: "文字转视频", labelEn: "Text to Video" },
    { id: "smart-shot", label: "智能射击", labelEn: "Smart Shot" },
    { id: "edit-video", label: "编辑视频", labelEn: "Edit Video", toolKey: "edit-video" },
    { id: "replace-background", label: "替换背景", labelEn: "Replace Background" },
    { id: "relight-video", label: "Relight Video", labelEn: "Relight Video" },
    { id: "visual-effects", label: "视觉特效", labelEn: "Visual Effects" },
    {
      id: "motion-sync",
      label: "运动同步",
      labelEn: "Motion Sync",
      toolKey: "motion-sync",
      description: "参考视频动作迁移到目标人物",
    },
    { id: "lip-sync", label: "唇语同步", labelEn: "Lip Sync", toolKey: "lip-sync" },
    { id: "hd-video", label: "高清视频", labelEn: "HD Video" },
    { id: "replace-character", label: "替换字符", labelEn: "Replace Character" },
    { id: "extend-video", label: "扩展视频", labelEn: "Extend Video" },
    { id: "add-sound", label: "添加音效", labelEn: "Add Sound Effects" },
    { id: "reshape-video", label: "重塑视频", labelEn: "Reshape Video" },
  ],
  image: [
    { id: "create-image", label: "创建图像", labelEn: "Create Image" },
    { id: "image-variation", label: "图像变化", labelEn: "Image Variation" },
    { id: "edit-image", label: "编辑图像", labelEn: "Edit Image", toolKey: "edit-image" },
    { id: "expand-image", label: "展开图片", labelEn: "Expand Image" },
    { id: "image-upscale", label: "图像放大", labelEn: "Upscale Image" },
    { id: "multi-view", label: "多视图", labelEn: "Multi-view" },
    { id: "camera-angle", label: "相机角度控制", labelEn: "Camera Angle Control" },
    { id: "face-swap", label: "换脸", labelEn: "Face Swap" },
    { id: "vellum-skin", label: "Vellum 皮肤增强剂", labelEn: "Vellum Skin Enhancer" },
  ],
  character: [
    { id: "create-character", label: "创建角色", labelEn: "Create Character" },
    { id: "browse-library", label: "浏览图书馆", labelEn: "Browse Library" },
    { id: "character-image", label: "角色图像", labelEn: "Character Image" },
    { id: "character-video", label: "角色视频", labelEn: "Character Video" },
    { id: "video-with-sound", label: "有声视频", labelEn: "Video with Sound" },
  ],
  world: [
    { id: "create-world", label: "创造世界", labelEn: "Create World" },
    { id: "world-camera", label: "3D世界摄像头", labelEn: "3D World Camera" },
    { id: "scene-actor", label: "场景演员", labelEn: "Scene Actors" },
  ],
  audio: [
    { id: "create-voiceover", label: "制作旁白", labelEn: "Create Voiceover" },
    { id: "create-music", label: "创作音乐", labelEn: "Create Music" },
    { id: "create-sfx", label: "创建音效", labelEn: "Create Sound Effects" },
    { id: "voice-clone", label: "语音克隆", labelEn: "Voice Cloning" },
    { id: "voice-changer", label: "变声器", labelEn: "Voice Changer" },
  ],
};

export function getKindDef(kindId: string): QrKindDef | null {
  for (const kinds of Object.values(QR_KINDS_BY_CATEGORY)) {
    const hit = kinds.find((k) => k.id === kindId);
    if (hit) return hit;
  }
  return null;
}

export function getKindsForCategory(category: QrCategory): QrKindDef[] {
  return QR_KINDS_BY_CATEGORY[category] ?? [];
}

export function isKnownKind(kindId: string): boolean {
  return getKindDef(kindId) != null;
}
