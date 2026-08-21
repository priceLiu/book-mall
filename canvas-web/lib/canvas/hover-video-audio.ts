/**
 * 门户首页视频「悬停播声音」：同一时刻只允许一个视频发声。
 */

let current: HTMLVideoElement | null = null;

/** 悬停时取消静音并播放；失败则回退静音。 */
export function makeVideoAudible(video: HTMLVideoElement): void {
  if (current && current !== video) {
    current.muted = true;
  }
  current = video;
  video.muted = false;
  if (video.volume === 0) video.volume = 1;
  void video.play().catch(() => {
    video.muted = true;
  });
}

export function muteVideo(video: HTMLVideoElement): void {
  video.muted = true;
  if (current === video) current = null;
}
