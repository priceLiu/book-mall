/**
 * 扫描：同一用户下不同画布项目是否共享大量相同 nodeId（跨项目图串写风险指纹）
 * 用法：cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/scan-canvas-cross-project-node-collision.ts [userId]
 */
import { prisma } from "../lib/prisma";

function nodeIds(canvas: unknown): string[] {
  if (!canvas || typeof canvas !== "object") return [];
  const nodes = (canvas as { nodes?: unknown }).nodes;
  if (!Array.isArray(nodes)) return [];
  return nodes
    .map((n) =>
      n && typeof n === "object" && typeof (n as { id?: unknown }).id === "string"
        ? (n as { id: string }).id
        : null,
    )
    .filter((id): id is string => Boolean(id));
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let n = 0;
  for (const id of a) {
    if (b.has(id)) n += 1;
  }
  return n;
}

async function main() {
  const userId =
    process.argv[2]?.trim() || "cmplfp85q0000r03ut03lft88";

  const projects = await prisma.canvasProject.findMany({
    where: { userId, deletedAt: null },
    select: {
      id: true,
      name: true,
      updatedAt: true,
      canvas: true,
      thumbnailUrl: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const byProject = projects.map((p) => {
    const ids = nodeIds(p.canvas);
    return {
      id: p.id,
      name: p.name,
      updatedAt: p.updatedAt,
      nodeCount: ids.length,
      idSet: new Set(ids),
      thumb: p.thumbnailUrl ?? "",
    };
  });

  console.log(`user=${userId} active projects=${byProject.length}\n`);

  const collisions: Array<{
    a: string;
    b: string;
    shared: number;
    aName: string;
    bName: string;
    aNodes: number;
    bNodes: number;
  }> = [];

  for (let i = 0; i < byProject.length; i += 1) {
    for (let j = i + 1; j < byProject.length; j += 1) {
      const A = byProject[i]!;
      const B = byProject[j]!;
      const shared = overlap(A.idSet, B.idSet);
      if (shared === 0) continue;
      const minSize = Math.min(A.idSet.size, B.idSet.size);
      if (shared >= 3 && shared >= minSize * 0.85) {
        collisions.push({
          a: A.id,
          b: B.id,
          shared,
          aName: A.name,
          bName: B.name,
          aNodes: A.nodeCount,
          bNodes: B.nodeCount,
        });
      }
    }
  }

  if (collisions.length === 0) {
    console.log("No high-overlap nodeId pairs (>=85% of smaller graph, >=3 ids).");
  } else {
    console.log("HIGH nodeId OVERLAP (possible cross-project graph bleed):");
    for (const c of collisions) {
      console.log(
        `  ${c.shared} shared | ${c.a.slice(0, 12)}… (${c.aName}, ${c.aNodes}n) <-> ${c.b.slice(0, 12)}… (${c.bName}, ${c.bNodes}n)`,
      );
    }
  }

  const thumbMismatch = byProject.filter((p) => {
    const m = p.thumb.match(/node-image\/([a-z0-9]{20,})/i);
    if (!m) return false;
    return m[1] !== p.id;
  });
  if (thumbMismatch.length) {
    console.log("\nThumbnail OSS path points at another project id:");
    for (const p of thumbMismatch) {
      console.log(`  ${p.id.slice(0, 12)}… ${p.name} thumb=${p.thumb.slice(0, 80)}…`);
    }
  } else {
    console.log("\nNo thumbnail node-image project id mismatches in sample paths.");
  }

  const histories = await prisma.canvasProjectHistory.findMany({
    where: { projectId: { in: projects.map((p) => p.id) } },
    select: { projectId: true, canvas: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const maxHistNodes = new Map<string, number>();
  for (const h of histories) {
    const n = nodeIds(h.canvas).length;
    const prev = maxHistNodes.get(h.projectId) ?? 0;
    if (n > prev) maxHistNodes.set(h.projectId, n);
  }

  const shrinkCandidates = byProject.filter((p) => {
    const maxH = maxHistNodes.get(p.id);
    if (!maxH || maxH < 10) return false;
    return p.nodeCount <= maxH * 0.25 && p.nodeCount < maxH - 5;
  });

  if (shrinkCandidates.length) {
    console.log("\nCurrent graph much smaller than best history snapshot (>=75% drop):");
    for (const p of shrinkCandidates) {
      console.log(
        `  ${p.id.slice(0, 12)}… ${p.name}: now ${p.nodeCount} nodes, history max ${maxHistNodes.get(p.id)}`,
      );
    }
  } else {
    console.log("\nNo >=75% node-count shrink vs history max (among projects with history).");
  }

  const noHistorySmall = byProject.filter(
    (p) => p.nodeCount > 0 && p.nodeCount <= 8 && !maxHistNodes.has(p.id),
  );
  if (noHistorySmall.length) {
    console.log("\nSmall projects (<=8 nodes) with ZERO history (cannot in-app restore):");
    for (const p of noHistorySmall.slice(0, 15)) {
      console.log(`  ${p.id.slice(0, 12)}… ${p.name} (${p.nodeCount}n)`);
    }
    if (noHistorySmall.length > 15) {
      console.log(`  … and ${noHistorySmall.length - 15} more`);
    }
  }
}

main().finally(() => prisma.$disconnect());
