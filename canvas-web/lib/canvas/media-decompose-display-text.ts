/**
 * 画布文本节点 · 拆图拆视频结果展示（与电商 ResultPanel 画面要素一致，非 JSON 围栏）
 */

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function coerceLighting(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      keyLight: "",
      fillLight: "",
      rimLight: "",
      ambientLight: "",
      direction: "",
      hardSoft: "",
      colorTemperature: "",
    };
  }
  const o = raw as Record<string, unknown>;
  return {
    keyLight: pickString(o, ["keyLight", "主光", "main"]),
    fillLight: pickString(o, ["fillLight", "辅光", "fill"]),
    rimLight: pickString(o, ["rimLight", "轮廓光", "rim"]),
    ambientLight: pickString(o, ["ambientLight", "环境光", "ambient"]),
    direction: pickString(o, ["direction", "方向"]),
    hardSoft: pickString(o, ["hardSoft", "软硬", "quality"]),
    colorTemperature: pickString(o, ["colorTemperature", "色温", "temperature"]),
  };
}

function stripMediaDecomposeFence(text: string): string {
  return text
    .replace(/```media-decompose[\s\S]*?```/gi, "")
    .replace(/```media-decompose[\s\S]*$/gi, "")
    .trim();
}

function extractFenceJsonBody(text: string): string | null {
  const closed = text.match(/```media-decompose\s*([\s\S]*?)```/i);
  if (closed?.[1]?.trim()) return closed[1].trim();
  return null;
}

function formatImageElementsBullets(o: Record<string, unknown>): string | null {
  const elementsRaw = o.elements ?? o.画面要素 ?? o.imageElements;
  if (!elementsRaw || typeof elementsRaw !== "object" || Array.isArray(elementsRaw)) {
    return null;
  }
  const e = elementsRaw as Record<string, unknown>;
  const l = coerceLighting(e.lighting ?? e.布光);
  const lines = [
    `- **主体**：${pickString(e, ["subject", "主体", "画面主体"])}`,
    `- **姿态**：${pickString(e, ["subjectPose", "姿态", "主体姿态"])}`,
    `- **场景**：${pickString(e, ["sceneEnvironment", "场景", "场景环境"])}`,
    `- **透视**：${pickString(e, ["spatialPerspective", "透视", "空间透视"])}`,
    `- **构图**：${pickString(e, ["composition", "构图", "构图方式"])}`,
    `- **等效焦距**：${pickString(e, ["equivalentFocalLength", "焦距", "等效焦距"])}`,
    `- **拍摄角度**：${pickString(e, ["shootingAngle", "拍摄角度", "角度"])}`,
    `- **布光**：主 ${l.keyLight}；辅 ${l.fillLight}；轮廓 ${l.rimLight}；环境 ${l.ambientLight}；方向 ${l.direction}；${l.hardSoft}；色温 ${l.colorTemperature}`,
    `- **材质**：${pickString(e, ["materialTexture", "材质", "材质质感"])}`,
    `- **色彩**：${pickString(e, ["colorSystem", "色彩", "色彩体系"])}`,
    `- **氛围**：${pickString(e, ["atmosphere", "氛围", "画面氛围"])}`,
    `- **细节**：${pickString(e, ["detailNotes", "细节"])}`,
  ];
  const positive = pickString(o, ["positivePrompt", "正向提示词", "positive"]);
  const negative = pickString(o, ["negativePrompt", "反向提示词", "negative"]);
  if (positive) lines.push("", `- **正向生图 Prompt**：${positive}`);
  if (negative) lines.push("", `- **反向负面 Prompt**：${negative}`);
  const body = lines.join("\n").trim();
  if (!body.replace(/[-*#\s：]/g, "").length) return null;
  return body;
}

function tryFormatFromJsonString(jsonStr: string): string | null {
  try {
    const parsed = JSON.parse(jsonStr) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    if (o.mediaType === "image") {
      return formatImageElementsBullets(o);
    }
  } catch {
    return null;
  }
  return null;
}

/** 将 task.textOutput / generatedOutlineMd 转为画布可读 Markdown（去掉 JSON 围栏） */
export function mediaDecomposeTextForCanvasNode(raw: string | undefined | null): string {
  const text = (raw ?? "").trim();
  if (!text) return "";

  if (!/```media-decompose/i.test(text) && !/"mediaType"\s*:\s*"image"/.test(text)) {
    return text;
  }

  const fenceBody = extractFenceJsonBody(text);
  if (fenceBody) {
    const fromFence = tryFormatFromJsonString(fenceBody);
    if (fromFence) return fromFence;
  }

  const start = text.lastIndexOf('{"mediaType"');
  if (start >= 0) {
    const end = text.lastIndexOf("}");
    if (end > start) {
      const fromEmbed = tryFormatFromJsonString(text.slice(start, end + 1));
      if (fromEmbed) return fromEmbed;
    }
  }

  const stripped = stripMediaDecomposeFence(text);
  if (stripped.length >= 40 && !stripped.startsWith("{")) {
    return stripped;
  }

  return text;
}
