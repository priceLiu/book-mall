export type ImageEditorCorrection = {
  /** 0–100，50 为不校正 */
  vertical: number;
  /** 0–100，50 为不校正 */
  horizontal: number;
  /** 0–100，50 为不校正 */
  center: number;
  /** 度，0 为不旋转 */
  rotate: number;
};

export const IMAGE_EDITOR_CORRECTION_DEFAULT: ImageEditorCorrection = {
  vertical: 50,
  horizontal: 50,
  center: 50,
  rotate: 0,
};

export function isImageEditorCorrectionNeutral(c: ImageEditorCorrection): boolean {
  return (
    c.vertical === 50 &&
    c.horizontal === 50 &&
    c.center === 50 &&
    c.rotate === 0
  );
}

/** 与画布预览同一组角度，供 CSS transform 叠加 */
export function imageEditorCorrectionCss(c: ImageEditorCorrection): string {
  if (isImageEditorCorrectionNeutral(c)) return "";
  const rx = ((c.vertical - 50) / 50) * 22;
  const ry = ((c.horizontal - 50) / 50) * -22;
  const scale = 1 + ((c.center - 50) / 50) * 0.22;
  return `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) rotate(${c.rotate}deg) scale(${scale})`;
}

function projectNorm(
  nx: number,
  ny: number,
  c: ImageEditorCorrection,
): { x: number; y: number } {
  const rx = ((c.vertical - 50) / 50) * 22 * (Math.PI / 180);
  const ry = ((c.horizontal - 50) / 50) * -22 * (Math.PI / 180);
  const rz = c.rotate * (Math.PI / 180);
  const scale = 1 + ((c.center - 50) / 50) * 0.22;
  let x = nx * scale;
  let y = ny * scale;
  let z = 0;
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const x1 = x * cosY + z * sinY;
  const z1 = -x * sinY + z * cosY;
  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  const y2 = y * cosX - z1 * sinX;
  const z2 = y * sinX + z1 * cosX;
  const dist = 2.4;
  const p = dist / Math.max(0.35, dist - z2);
  x = x1 * p;
  y = y2 * p;
  const cosZ = Math.cos(rz);
  const sinZ = Math.sin(rz);
  return { x: x * cosZ - y * sinZ, y: x * sinZ + y * cosZ };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = src;
  });
}

/** 把校正烘焙进位图，输出与预览同一透视 */
export async function renderImageEditorCorrection(
  src: string,
  c: ImageEditorCorrection,
): Promise<string> {
  if (isImageEditorCorrectionNeutral(c)) return src;
  const img = await loadImage(src);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  const cols = 18;
  const rows = 18;
  const toPx = (u: number, v: number) => {
    const p = projectNorm(u / w - 0.5, v / h - 0.5, c);
    return { x: (p.x + 0.5) * w, y: (p.y + 0.5) * h };
  };

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const u0 = (i / cols) * w;
      const v0 = (j / rows) * h;
      const u1 = ((i + 1) / cols) * w;
      const v1 = ((j + 1) / rows) * h;
      const d00 = toPx(u0, v0);
      const d10 = toPx(u1, v0);
      const d01 = toPx(u0, v1);
      const d11 = toPx(u1, v1);
      drawTriangle(ctx, img, u0, v0, u1, v0, u0, v1, d00, d10, d01);
      drawTriangle(ctx, img, u1, v0, u1, v1, u0, v1, d10, d11, d01);
    }
  }
  return canvas.toDataURL("image/png");
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  u2: number,
  v2: number,
  d0: { x: number; y: number },
  d1: { x: number; y: number },
  d2: { x: number; y: number },
) {
  const denom = u0 * (v1 - v2) + u1 * (v2 - v0) + u2 * (v0 - v1);
  if (Math.abs(denom) < 1e-4) return;
  const a = (d0.x * (v1 - v2) + d1.x * (v2 - v0) + d2.x * (v0 - v1)) / denom;
  const b = (d0.y * (v1 - v2) + d1.y * (v2 - v0) + d2.y * (v0 - v1)) / denom;
  const c = (d0.x * (u2 - u1) + d1.x * (u0 - u2) + d2.x * (u1 - u0)) / denom;
  const d = (d0.y * (u2 - u1) + d1.y * (u0 - u2) + d2.y * (u1 - u0)) / denom;
  const e =
    (d0.x * (u1 * v2 - u2 * v1) + d1.x * (u2 * v0 - u0 * v2) + d2.x * (u0 * v1 - u1 * v0)) / denom;
  const f =
    (d0.y * (u1 * v2 - u2 * v1) + d1.y * (u2 * v0 - u0 * v2) + d2.y * (u0 * v1 - u1 * v0)) / denom;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(d1.x, d1.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}
