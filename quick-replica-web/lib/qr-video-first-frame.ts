/** 从本地视频文件截取首帧，返回 JPEG data URL（用于自动生成封面） */
export async function captureVideoFirstFrameDataUrl(
  file: File,
  opts?: { maxWidth?: number; quality?: number; seekSeconds?: number },
): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("无法读取视频元数据"));
      video.src = objectUrl;
    });

    const seekTo = Math.min(
      opts?.seekSeconds ?? 0.08,
      Math.max(0, (video.duration || 1) - 0.05),
    );
    video.currentTime = seekTo;

    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("无法定位视频帧"));
    });

    const maxWidth = opts?.maxWidth ?? 1280;
    let width = video.videoWidth;
    let height = video.videoHeight;
    if (!width || !height) throw new Error("视频尺寸无效");
    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建画布");
    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", opts?.quality ?? 0.88);
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}
