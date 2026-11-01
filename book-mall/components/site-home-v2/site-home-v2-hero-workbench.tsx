"use client";

import { useState } from "react";

const CHIPS = ["办公日常", "内容创作", "图像创意", "视频创作", "音乐制作"] as const;

export function SiteHomeV2HeroWorkbenchBody() {
  const [active, setActive] = useState(0);

  return (
    <div className="workbench-body">
      <div className="model-chip-row" role="list" aria-label="示例场景类型">
        {CHIPS.map((label, i) => (
          <button
            key={label}
            type="button"
            role="listitem"
            className={`model-chip${active === i ? " is-active" : ""}`}
            onClick={() => setActive(i)}
          >
            <span className="dot" aria-hidden />
            {label}
          </button>
        ))}
      </div>
      <div className="canvas-mock">
        <div className="canvas-toolbar" aria-hidden>
          <span className="tool-chip">技能</span>
          <span className="tool-chip">素材</span>
          <span className="tool-chip">协同</span>
          <span className="tool-chip">导出</span>
        </div>
        <div className="canvas-stage">
          <div>
            <strong>创作画布预览</strong>
            选好场景后，用官方技能完成生成与编排
          </div>
        </div>
        <div className="canvas-meta">
          <span>能力：创作 / 协同 / 赋能</span>
          <span>状态：等待生成</span>
        </div>
      </div>
    </div>
  );
}
