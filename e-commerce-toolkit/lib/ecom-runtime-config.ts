/** 服务端 shell 注入的主站 origin（弥补 NEXT_PUBLIC 未在构建时 bake 的情况） */
let runtimeBookOrigin: string | null = null;

export function setEcomRuntimeBookOrigin(origin: string): void {
  const v = origin?.trim().replace(/\/$/, "");
  runtimeBookOrigin = v || null;
}

export function getEcomRuntimeBookOrigin(): string | null {
  return runtimeBookOrigin;
}
