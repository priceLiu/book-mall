import type Archiver from "archiver";

/**
 * archiver@8 仅导出 ZipArchive 类，@types/archiver@7 尚未同步，故手写构造签名。
 * 包是 ESM-only：必须动态 `import`，`require` 会让 webpack 在编译期报
 * `ESM packages (archiver) need to be imported`。
 */
export async function createZipArchive(options?: {
  zlib?: { level?: number };
}): Promise<Archiver.Archiver> {
  const mod = (await import("archiver")) as unknown as {
    ZipArchive: new (opts?: object) => Archiver.Archiver;
  };
  return new mod.ZipArchive({
    zlib: { level: 6 },
    ...options,
  });
}

export function formatExportTimestamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}
