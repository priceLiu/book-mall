#!/usr/bin/env node
/**
 * 电商工具箱 · 媒体布局抽检（本地警告，不阻塞 CI）
 * 排除 ECOM_MEDIA_EXEMPT_PATH_PREFIXES 见 lib/media/ecom-media-display-spec.ts
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ECOM = path.join(ROOT, "e-commerce-toolkit");
const COMPONENTS = path.join(ECOM, "components");

const EXEMPT = [
  "components/vton/",
  "components/hand-craft/",
  "components/brand-vi/",
  "app/ecom/model-tryon/",
];

const RULES = [
  {
    name: "main-result-w-112px",
    re: /w-\[112px\]/,
    hint: "工作区主成片勿用 112px 固定宽，见 ECOM_WORKSPACE_RESULT_GRID_CLASS",
  },
  {
    name: "deliverable-gallery-slot",
    re: /EcomVideoSlot[\s\S]{0,400}layout=["'](?:gallery|gallery-workspace)["']/,
    hint: "单条最终成片应用 EcomDeliverableVideoPreview（T2v）",
  },
];

function isExempt(rel) {
  const norm = rel.replace(/\\/g, "/");
  return EXEMPT.some((p) => norm.includes(p));
}

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (/\.(tsx|ts|jsx|js)$/.test(name)) acc.push(full);
  }
  return acc;
}

let issues = 0;

for (const file of walk(COMPONENTS)) {
  const rel = path.relative(ECOM, file);
  if (isExempt(rel)) continue;
  const text = fs.readFileSync(file, "utf8");
  for (const rule of RULES) {
    if (rule.re.test(text)) {
      console.warn(`[ecom-media-layout] ${rule.name}: ${rel}\n  → ${rule.hint}`);
      issues += 1;
    }
  }
}

if (issues === 0) {
  console.log("[ecom-media-layout] OK (no issues in non-exempt paths)");
} else {
  console.warn(`[ecom-media-layout] ${issues} warning(s)`);
  process.exitCode = 0;
}