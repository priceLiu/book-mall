import html2canvas from "html2canvas";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = src;
  });
}

/** 把指定文字层的当前画面画进底图，返回新的 PNG data URL。 */
export async function flattenImageEditorTextLayers(
  imageUrl: string,
  naturalW: number,
  naturalH: number,
  layerIds: string[],
): Promise<string> {
  const content = document.querySelector<HTMLElement>("[data-text-content]");
  if (!content) throw new Error("找不到画布");
  const frames = layerIds
    .map((id) => document.querySelector<HTMLElement>(`[data-layer-id="${CSS.escape(id)}"]`))
    .filter((node): node is HTMLElement => Boolean(node));
  if (!frames.length) throw new Error("找不到要合并的文字");

  const contentRect = content.getBoundingClientRect();
  const scaleX = naturalW / Math.max(1, contentRect.width);
  const scaleY = naturalH / Math.max(1, contentRect.height);
  const img = await loadImage(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = naturalW;
  canvas.height = naturalH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法绘图");
  ctx.drawImage(img, 0, 0, naturalW, naturalH);

  const holder = document.createElement("div");
  holder.style.cssText = "position:fixed;left:-12000px;top:0;z-index:-1;pointer-events:none;";
  document.body.appendChild(holder);
  try {
    for (const frame of frames) {
      const rect = frame.getBoundingClientRect();
      const clone = frame.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("[data-text-chrome], [data-text-handle]").forEach((node) => node.remove());
      clone.classList.remove("ring-2", "ring-[#3d7eff]/85");
      clone.style.transform = "none";
      clone.style.position = "relative";
      clone.style.left = "0";
      clone.style.top = "0";
      clone.style.outline = "none";
      clone.querySelectorAll<HTMLElement>("[data-text-mark]").forEach((mark) => {
        mark.style.outline = "none";
      });
      const poster = frame.querySelector("img[data-text-glyphs]");
      if (poster instanceof HTMLImageElement && poster.naturalWidth > 0) {
        const box = poster.getBoundingClientRect();
        const x = (box.left - contentRect.left) * scaleX;
        const y = (box.top - contentRect.top) * scaleY;
        ctx.drawImage(poster, x, y, box.width * scaleX, box.height * scaleY);
        continue;
      }
      holder.replaceChildren(clone);
      const shot = await html2canvas(clone, {
        backgroundColor: null,
        scale: Math.max(2, scaleX, scaleY),
        useCORS: true,
        logging: false,
      });
      const x = (rect.left - contentRect.left) * scaleX;
      const y = (rect.top - contentRect.top) * scaleY;
      ctx.drawImage(shot, x, y, rect.width * scaleX, rect.height * scaleY);
    }
  } finally {
    holder.remove();
  }
  return canvas.toDataURL("image/png");
}
