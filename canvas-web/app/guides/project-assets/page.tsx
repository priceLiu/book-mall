import Link from "next/link";

export const metadata = {
  title: "项目资产使用说明 · canvas-web",
  description:
    "影视专业版角色四槽、场景三槽与分镜 @ 引用的操作说明。",
};

export default function ProjectAssetsGuidePage() {
  return (
    <div className="canvas-container max-w-3xl py-10 pb-16">
      <header className="mb-10">
        <p className="twenty-eyebrow">canvas-web · story-pro · 用户指南</p>
        <h1 className="canvas-serif mt-3 text-3xl text-white">项目资产 · 使用说明</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--canvas-muted)]">
          本文面向影视专业版操作者，说明「角色四槽」「场景三槽」与分镜 @ 引用的关系与推荐流程。
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/assets" className="twenty-btn-accent text-sm">
            打开我的项目资产
          </Link>
          <Link href="/projects" className="twenty-btn-ghost text-sm">
            我的画布
          </Link>
        </div>
      </header>

      <GuideSection title="入口在哪里？">
        <ul className="guide-list">
          <li>
            <strong>全站页</strong>：顶部导航「项目资产」→{" "}
            <Link href="/assets" className="text-cyan-300 hover:underline">
              /assets
            </Link>
            ，按项目查看 / 锁定角色与场景库。
          </li>
          <li>
            <strong>画布内</strong>：影视专业版画布工具栏「项目资产」侧栏，与全站页数据一致。
          </li>
          <li>
            <strong>行内编辑</strong>：人物设计列、场景设计列每行下方的四槽 / 三槽面板，用于上传与入库。
          </li>
        </ul>
      </GuideSection>

      <GuideSection title="图 1 · 人物设计：预览区 + 四槽参考">
        <p className="guide-p">
          每一行角色由<strong>两个层次</strong>组成，不要混为一谈：
        </p>
        <div className="guide-card">
          <p className="font-medium text-cyan-100">① 右侧大预览（三视图生成区）</p>
          <p className="mt-1 text-sm text-[var(--canvas-muted)]">
            根据左侧 prompt 调用生图模型，产出<strong>当前这一次</strong>的三视图结果（正/侧/背合一图）。
            点击中央刷新图标 = 重新生成；有图后 hover 出现「重新生成 / 预览」。
          </p>
        </div>
        <div className="guide-card mt-3">
          <p className="font-medium text-cyan-100">② 下方「角色资产 · 四槽参考」</p>
          <p className="mt-1 text-sm text-[var(--canvas-muted)]">
            持久化存入<strong>项目资产库</strong>。三视图入库时会<strong>自动从正面列裁切</strong>脸 / 全身 / 服装（仅填空槽）；不满意可手动 ↑ 上传替换。
          </p>
          <ul className="guide-list mt-2">
            <li>
              <strong>脸</strong>：正面上部（自动裁切或上传）
            </li>
            <li>
              <strong>全身</strong>：正面全身（自动裁切或上传）
            </li>
            <li>
              <strong>服装</strong>：正面躯干（自动裁切或上传）
            </li>
            <li>
              <strong>三视图</strong>：完整正侧背图；从上方预览「入库」
            </li>
          </ul>
        </div>
        <p className="guide-p mt-4">
          <strong>推荐操作顺序</strong>：先选生图模型 → 生成三视图 → 点三视图槽「生成」入库 → 按需补脸 / 全身 / 服装（上传或从生成图导入）→ 重要槽位点🔒锁定 → 分镜列 @ 该角色。
        </p>
        <p className="guide-p">
          锁定规则：🔒 锁定的槽会优先注入三视图 re-run 与分镜 @ 目录；未锁定时每槽默认取最新一张。
        </p>
      </GuideSection>

      <GuideSection title="图 2 · 场景设计：预览区 + 三槽参考">
        <p className="guide-p">
          场景行同样是<strong>预览区 + 资产槽</strong>两层结构（场景为<strong>三槽</strong>，不是四槽）：
        </p>
        <div className="guide-card">
          <p className="font-medium text-cyan-100">① 右侧大预览</p>
          <p className="mt-1 text-sm text-[var(--canvas-muted)]">
            本镜 / 本场景的<strong>一次性场景参考图</strong>生成结果（如「教室特写 + 晨光」）。
          </p>
        </div>
        <div className="guide-card mt-3">
          <p className="font-medium text-cyan-100">② 下方「场景资产 · 三槽参考」</p>
          <ul className="guide-list mt-2">
            <li>
              <strong>全景</strong>：establishing，交代空间布局。
            </li>
            <li>
              <strong>细节</strong>：道具、材质、局部。
            </li>
            <li>
              <strong>氛围</strong>：光线、色调、情绪。
            </li>
          </ul>
        </div>
        <p className="guide-p mt-4">
          入库后，在<strong>分镜列</strong> prompt 里 @ 场景 ref，可跨多镜复用同一教室 / 街道，避免每镜重画环境。
        </p>
      </GuideSection>

      <GuideSection title="三视图 vs 场景设计 · 什么关系？">
        <ul className="guide-list">
          <li>
            <strong>人物三视图</strong>：解决「谁长什么样、穿什么」→ 角色一致性。
          </li>
          <li>
            <strong>场景参考</strong>：解决「在哪儿、什么光什么气氛」→ 环境一致性。
          </li>
          <li>
            二者<strong>并行、互补</strong>，都在「风格定稿」之后使用；分镜静帧可同时 @ 多个角色 ref + 场景 ref。
          </li>
          <li>
            流水线：故事定稿 → 风格定稿 → 人物四槽 + 场景三槽（可选）→ 分镜 @ → 静帧过审 → 视频。
          </li>
        </ul>
      </GuideSection>

      <GuideSection title="分镜列怎么用资产？">
        <ul className="guide-list">
          <li>
            在分镜 prompt 输入 <code className="guide-code">@</code>，从目录选角色 / 场景 ref。
          </li>
          <li>
            对白含角色名时，行内会提示「建议 @」，可一键插入。
          </li>
          <li>
            底栏「为本列补齐 @ 角色」可批量写入。
          </li>
          <li>
            保存 prompt 时会记录资产 version；换脸后行内提示「资产已更新 · 建议重跑静帧」。
          </li>
        </ul>
      </GuideSection>

      <GuideSection title="常见问题">
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="font-medium text-white">点刷新没反应？</dt>
            <dd className="mt-1 text-[var(--canvas-muted)]">
              请确认：① 已在上方选择生图模型；② 影视专业版需先完成<strong>风格定稿</strong>；③
              若行内出现红色错误文案，按提示处理（如 Gateway Key、模型能力不匹配）。
            </dd>
          </div>
          <div>
            <dt className="font-medium text-white">上方已有三视图，四槽还是空的？</dt>
            <dd className="mt-1 text-[var(--canvas-muted)]">
              预览区不会自动入库。在四槽上方点「保存到三视图槽」，或三视图槽下的「入库」，或底部「快捷保存上方三视图到资产库」。<strong>不需要在四槽再生成一次。</strong>
            </dd>
          </div>
          <div>
            <dt className="font-medium text-white">节点面板不见了？</dt>
            <dd className="mt-1 text-[var(--canvas-muted)]">
              画布左下角有「节点面板 · 顶部/右侧」按钮，点击可在顶部与右侧之间切换。
            </dd>
          </div>
          <div>
            <dt className="font-medium text-white">资产存在哪里？</dt>
            <dd className="mt-1 text-[var(--canvas-muted)]">
              云端数据库 + OSS，按登录用户与画布 projectId 隔离；全站「项目资产」页与画布侧栏读取同一份数据。
            </dd>
          </div>
        </dl>
      </GuideSection>

      <footer className="mt-12 border-t border-white/10 pt-6 text-sm text-[var(--canvas-muted)]">
        技术文档（开发）：{" "}
        <code className="guide-code">canvas-web/docs/story-pro-character-asset-workflow.md</code>
      </footer>
    </div>
  );
}

function GuideSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="canvas-serif mb-4 text-xl text-white">{title}</h2>
      {children}
    </section>
  );
}
