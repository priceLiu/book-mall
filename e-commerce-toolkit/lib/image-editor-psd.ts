/**
 * 按 Adobe《Photoshop File Formats Specification》写单图层 RGB PSD。
 * https://www.adobe.com/devnet-apps/photoshop/fileformatashtml/
 *
 * 结构：文件头 → 色彩模式（长度 0）→ 图像资源 → 图层与蒙版 → 合并图像。
 * 图层含 R/G/B 与透明通道（通道号 -1）。合并图是 RGB，供 Photoshop 的兼容预览。
 */

const SIG_8BPS = ascii("8BPS");
const SIG_8BIM = ascii("8BIM");

export type PsdRgbaLayer = {
  /** 图层名。Pascal 名用 ASCII，Photoshop 5 起的显示名走 luni（UTF-16）。 */
  name: string;
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
};

class Bin {
  private readonly parts: Uint8Array[] = [];
  private length = 0;

  u8(value: number) {
    this.bytes(Uint8Array.of(value & 0xff));
  }

  u16(value: number) {
    const buf = new Uint8Array(2);
    new DataView(buf.buffer).setUint16(0, value);
    this.bytes(buf);
  }

  u32(value: number) {
    const buf = new Uint8Array(4);
    new DataView(buf.buffer).setUint32(0, value >>> 0);
    this.bytes(buf);
  }

  i32(value: number) {
    const buf = new Uint8Array(4);
    new DataView(buf.buffer).setInt32(0, value | 0);
    this.bytes(buf);
  }

  ascii(value: string) {
    this.bytes(ascii(value));
  }

  bytes(value: Uint8Array) {
    this.parts.push(value);
    this.length += value.length;
  }

  size() {
    return this.length;
  }

  toUint8Array(): Uint8Array {
    const out = new Uint8Array(this.length);
    let offset = 0;
    for (const part of this.parts) {
      out.set(part, offset);
      offset += part.length;
    }
    return out;
  }
}

function ascii(value: string): Uint8Array {
  const out = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) out[i] = value.charCodeAt(i) & 0xff;
  return out;
}

/** 规范：Unicode string = 4 字节个数（UTF-16 码元）+ UTF-16BE + 结尾 2 字节 0。个数含结尾 0。 */
function unicodeString(value: string): Uint8Array {
  const units: number[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    units.push(code);
  }
  units.push(0);
  const out = new Uint8Array(4 + units.length * 2);
  const view = new DataView(out.buffer);
  view.setUint32(0, units.length);
  for (let i = 0; i < units.length; i += 1) view.setUint16(4 + i * 2, units[i]!);
  return out;
}

/** Pascal 字符串，整段（含长度字节）补到 4 的倍数。 */
function pascalName(value: string): Uint8Array {
  const raw = ascii(value.slice(0, 255));
  const size = 1 + raw.length;
  const padded = size + ((4 - (size % 4)) % 4);
  const out = new Uint8Array(padded);
  out[0] = raw.length;
  out.set(raw, 1);
  return out;
}

function tagged(key: string, data: Uint8Array): Uint8Array {
  const bin = new Bin();
  bin.bytes(SIG_8BIM);
  bin.ascii(key);
  const even = data.length + (data.length % 2);
  bin.u32(even);
  bin.bytes(data);
  if (even !== data.length) bin.u8(0);
  return bin.toUint8Array();
}

function blendRanges(): Uint8Array {
  const bin = new Bin();
  // 合成 + R/G/B/A，每段源范围、目标范围各 4 字节：0,0,255,255
  const pairs = 5 * 2;
  bin.u32(pairs * 4);
  for (let i = 0; i < pairs; i += 1) {
    bin.u8(0);
    bin.u8(0);
    bin.u8(255);
    bin.u8(255);
  }
  return bin.toUint8Array();
}

function resolutionResource(): Uint8Array {
  const data = new Bin();
  const dpi = 72 << 16;
  data.u32(dpi);
  data.u16(1);
  data.u16(1);
  data.u32(dpi);
  data.u16(1);
  data.u16(1);
  const block = new Bin();
  block.bytes(SIG_8BIM);
  block.u16(1005);
  block.u16(0);
  block.u32(data.size());
  block.bytes(data.toUint8Array());
  return block.toUint8Array();
}

function plane(rgba: Uint8ClampedArray, width: number, height: number, channel: number): Uint8Array {
  const count = width * height;
  const out = new Uint8Array(count);
  if (channel === 3) {
    for (let i = 0; i < count; i += 1) out[i] = rgba[i * 4 + 3] ?? 0;
    return out;
  }
  for (let i = 0; i < count; i += 1) out[i] = rgba[i * 4 + channel] ?? 0;
  return out;
}

function compositeRgb(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array[] {
  const count = width * height;
  const red = new Uint8Array(count);
  const green = new Uint8Array(count);
  const blue = new Uint8Array(count);
  for (let i = 0; i < count; i += 1) {
    const o = i * 4;
    const a = rgba[o + 3] ?? 0;
    const keep = a / 255;
    const fill = 1 - keep;
    red[i] = Math.round((rgba[o] ?? 0) * keep + 255 * fill);
    green[i] = Math.round((rgba[o + 1] ?? 0) * keep + 255 * fill);
    blue[i] = Math.round((rgba[o + 2] ?? 0) * keep + 255 * fill);
  }
  return [red, green, blue];
}

/** 原始通道：2 字节压缩码 0 + 不换行填充的像素。长度含这 2 字节。 */
function rawChannel(pixels: Uint8Array): { bytes: Uint8Array; length: number } {
  const bytes = new Uint8Array(2 + pixels.length);
  bytes.set(pixels, 2);
  return { bytes, length: bytes.length };
}

export function encodeCutoutPsd(layer: PsdRgbaLayer): Uint8Array {
  const { width, height, rgba } = layer;
  if (width < 1 || height < 1 || width > 30000 || height > 30000) {
    throw new Error("图片尺寸超出 PSD 上限");
  }
  if (rgba.length < width * height * 4) throw new Error("抠图像素不完整");

  const channels = [
    { id: 0, pixels: plane(rgba, width, height, 0) },
    { id: 1, pixels: plane(rgba, width, height, 1) },
    { id: 2, pixels: plane(rgba, width, height, 2) },
    { id: -1, pixels: plane(rgba, width, height, 3) },
  ].map((item) => ({ id: item.id, ...rawChannel(item.pixels) }));

  const luni = tagged("luni", unicodeString(layer.name || "抠图"));
  const lyid = tagged("lyid", (() => {
    const id = new Uint8Array(4);
    new DataView(id.buffer).setUint32(0, 1);
    return id;
  })());
  const name = pascalName("cutout");
  const mask = new Uint8Array(4);
  const blend = blendRanges();
  const extra = new Bin();
  extra.bytes(mask);
  extra.bytes(blend);
  extra.bytes(name);
  extra.bytes(luni);
  extra.bytes(lyid);

  const record = new Bin();
  record.i32(0);
  record.i32(0);
  record.i32(height);
  record.i32(width);
  record.u16(channels.length);
  for (const channel of channels) {
    record.u16(channel.id < 0 ? 65536 + channel.id : channel.id);
    record.u32(channel.length);
  }
  record.bytes(SIG_8BIM);
  record.ascii("norm");
  record.u8(255);
  record.u8(0);
  // 规范写 bit 1 为可见。Photoshop 实际把 bit 1 当成隐藏，可见图层置 bit 3（Photoshop 5 及以后）。
  record.u8(0x08);
  record.u8(0);
  record.u32(extra.size());
  record.bytes(extra.toUint8Array());

  const channelData = new Bin();
  for (const channel of channels) channelData.bytes(channel.bytes);

  const layerBody = new Bin();
  layerBody.u16(1);
  layerBody.bytes(record.toUint8Array());
  layerBody.bytes(channelData.toUint8Array());
  if (layerBody.size() % 2) layerBody.u8(0);

  const layerInfo = new Bin();
  layerInfo.u32(layerBody.size());
  layerInfo.bytes(layerBody.toUint8Array());

  const layerAndMask = new Bin();
  layerAndMask.bytes(layerInfo.toUint8Array());
  layerAndMask.u32(0);

  const resources = resolutionResource();
  const merged = compositeRgb(rgba, width, height);

  const file = new Bin();
  file.bytes(SIG_8BPS);
  file.u16(1);
  file.bytes(new Uint8Array(6));
  file.u16(3);
  file.u32(height);
  file.u32(width);
  file.u16(8);
  file.u16(3);
  file.u32(0);
  file.u32(resources.length);
  file.bytes(resources);
  file.u32(layerAndMask.size());
  file.bytes(layerAndMask.toUint8Array());
  file.u16(0);
  for (const item of merged) file.bytes(item);
  return file.toUint8Array();
}
