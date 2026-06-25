/**
 * 首页视频「悬停播声音」协调器。
 * 全站任一时刻只允许一个视频发声：新视频发声时，自动把上一个静音，
 * 避免多个视频（首屏背景 / 小窗 / 卡片）同时出声造成嘈杂。
 */

let current: HTMLVideoElement | null = null;

/** 悬停时让该视频发声（取消静音并播放），同时静音上一个。 */
export function makeVideoAudible(video: HTMLVideoElement): void {
  if (current && current !== video) {
    current.muted = true;
  }
  current = video;
  video.muted = false;
  if (video.volume === 0) video.volume = 1;
  // 浏览器可能因缺少用户手势拦截带声播放：失败则保持静音回退，不抛错。
  void video.play().catch(() => {
    video.muted = true;
  });
}

/** 移开时静音该视频（不强制暂停，循环背景可继续播放）。 */
export function muteVideo(video: HTMLVideoElement): void {
  video.muted = true;
  if (current === video) current = null;
}
