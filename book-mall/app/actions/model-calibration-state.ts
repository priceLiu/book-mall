/**
 * v003 修：`app/actions/model-calibration.ts` 是 `"use server"` 文件，
 * Next.js 规定其只能 `export` async 函数。早先把 `CalibrationActionState`
 * 类型与 `calibrationActionIdle` 常量也 export 在那里，会在运行时报
 *   `A "use server" file can only export async functions, found object.`
 *
 * 把"非函数"的部分挪到本文件（**不带** "use server"），server action 文件
 * 仅 `import type`（类型被 TS 编译擦除，不留任何 runtime export），
 * Client Component 则正常 import 常量。
 */

export type CalibrationActionState =
  | { kind: "idle" }
  | { kind: "ok"; message: string }
  | { kind: "error"; message: string };

export const calibrationActionIdle: CalibrationActionState = { kind: "idle" };
