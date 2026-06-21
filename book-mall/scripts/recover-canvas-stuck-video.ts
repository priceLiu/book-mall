/**
 * 恢复卡住的画布视频：Gateway/任务已成功但 canvas JSON runtime 未写回。
 *
 *   # 仅列出待恢复项
 *   pnpm canvas:recover-stuck-video -- --dry-run
 *
 *   # 恢复全部扫描到的任务
 *   pnpm canvas:recover-stuck-video -- --apply
 *
 *   # 指定项目
 *   pnpm canvas:recover-stuck-video -- --apply --project cmqnjwtg706g5uz01hpe13smj
 *
 *   # 指定任务 ID
 *   pnpm canvas:recover-stuck-video -- --apply cmqnopa7c0803uz016xhx7cpk
 */
import {
  findCanvasVideoTasksNeedingRecovery,
  recoverCanvasVideoProjectDisplay,
  recoverCanvasVideoTaskDisplay,
} from "../lib/canvas/canvas-video-display-recover";

function parseArgs(argv: string[]) {
  let dryRun = true;
  let projectId: string | undefined;
  const taskIds: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--apply") dryRun = false;
    else if (arg === "--dry-run") dryRun = true;
    else if (arg.startsWith("--project=")) {
      projectId = arg.slice("--project=".length);
    } else if (arg === "--project") {
      projectId = argv[i + 1]?.trim() || undefined;
      if (projectId) i += 1;
    } else if (!arg.startsWith("--") && arg.trim()) {
      taskIds.push(arg.trim());
    }
  }
  return { dryRun, projectId, taskIds };
}

async function main() {
  const { dryRun, projectId, taskIds } = parseArgs(process.argv.slice(2));

  if (projectId) {
    const candidates = await findCanvasVideoTasksNeedingRecovery({ projectId });
    console.log(
      `[recover] project=${projectId} candidates=${candidates.length} dryRun=${dryRun}`,
    );
    for (const c of candidates) {
      console.log(JSON.stringify(c));
    }
    if (dryRun) {
      console.log("[dry-run] re-run with --apply to patch canvas JSON");
      return;
    }
    const results = await recoverCanvasVideoProjectDisplay(projectId);
    for (const r of results) {
      console.log("[recover]", r);
    }
    return;
  }

  if (taskIds.length > 0) {
    console.log(`[recover] mode=tasks dryRun=${dryRun} count=${taskIds.length}`);
    for (const taskId of taskIds) {
      if (dryRun) {
        console.log(`[dry-run] would recover task ${taskId}`);
        continue;
      }
      const r = await recoverCanvasVideoTaskDisplay(taskId);
      console.log("[recover]", r);
    }
    return;
  }

  const candidates = await findCanvasVideoTasksNeedingRecovery({ limit: 500 });
  console.log(`[recover] scan candidates=${candidates.length} dryRun=${dryRun}`);
  for (const c of candidates) {
    console.log(JSON.stringify(c));
  }

  if (dryRun) {
    console.log("[dry-run] re-run with --apply to recover all listed tasks");
    return;
  }

  const byProject = new Map<string, typeof candidates>();
  for (const c of candidates) {
    const list = byProject.get(c.projectId) ?? [];
    list.push(c);
    byProject.set(c.projectId, list);
  }

  for (const [pid, list] of byProject) {
    console.log(`[recover] project ${pid} (${list[0]?.projectName}) tasks=${list.length}`);
    const results = await recoverCanvasVideoProjectDisplay(pid);
    for (const r of results) {
      if (r.action !== "noop") console.log("[recover]", r);
    }
  }
}

main()
  .catch((e) => {
    console.error("[recover-canvas-stuck-video] error", e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../lib/prisma");
    await prisma.$disconnect();
  });
