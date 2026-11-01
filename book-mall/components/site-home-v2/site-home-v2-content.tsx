import Link from "next/link";
import type { QrTemplateJson } from "@/lib/quick-replica/qr-types";
import { BOOK_PORTAL_EXTERNAL_LINK_PROPS } from "@/lib/portal-nav";
import {
  HOME_V2_ANCHORS,
  homeV2CanvasHref,
  homeV2EcomHref,
  homeV2QuickReplicaHref,
  homeV2ToolHref,
} from "@/lib/site-home-v2/links";
import { HOME_V2_MEDIA } from "@/lib/site-home-v2/media";
import { SiteHomeV2HeroWorkbenchBody } from "./site-home-v2-hero-workbench";
import { SiteHomeV2Motion } from "./site-home-v2-motion";
import { SiteHomeV2Nav } from "./site-home-v2-nav";
import {
  HomeV2SkillIcon,
  HomeV2SkillsHeadIcon,
  type HomeV2SkillIconKey,
} from "./site-home-v2-skill-icons";

function TextLinkArrow({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  const inner = (
    <>
      {children}{" "}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
        style={{ width: 14, height: 14, display: "inline", verticalAlign: "-2px" }}
      >
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </>
  );
  if (external) {
    return (
      <a className="text-link" href={href} {...BOOK_PORTAL_EXTERNAL_LINK_PROPS}>
        {inner}
      </a>
    );
  }
  return (
    <Link className="text-link" href={href}>
      {inner}
    </Link>
  );
}

const SCENES = [
  {
    title: "办公日常",
    body: "PPT 汇报、调研报告与业务文档，从大纲到可编辑成稿一次完成。",
    variant: "is-soft" as const,
    media: HOME_V2_MEDIA.scenes.office,
    link: { label: "了解技能", href: HOME_V2_ANCHORS.skills, external: false },
  },
  {
    title: "内容创作",
    body: "文档转小红书图文、公众号排版，把长稿变成可发布的内容形态。",
    variant: "is-dark" as const,
    media: HOME_V2_MEDIA.scenes.content,
    link: { label: "了解技能", href: HOME_V2_ANCHORS.skills, external: false },
  },
  {
    title: "图像创意",
    body: "电商详情页、主图与营销视觉，按卖点生成可转化素材。",
    variant: "is-dark" as const,
    media: HOME_V2_MEDIA.scenes.image,
    link: { label: "进入电商工具箱", href: homeV2EcomHref(), external: true },
  },
  {
    title: "视频创作",
    body: "上传产品图与脚本，生成产品片、短视频广告与直播话术方案。",
    variant: "is-soft" as const,
    media: HOME_V2_MEDIA.scenes.video,
    link: { label: "进入影视画布", href: homeV2CanvasHref(), external: true },
  },
  {
    title: "音乐制作",
    body: "配乐与音效并入工作台，和画面、脚本一起编排，减少来回导出。专项技能持续补充，可在技能商店继续探索。",
    variant: "span-full is-dark" as const,
    media: HOME_V2_MEDIA.scenes.music,
    link: { label: "前往技能商店", href: homeV2ToolHref(), external: true },
  },
];

const SKILLS: {
  meta: string;
  title: string;
  body: string;
  icon: HomeV2SkillIconKey;
}[] = [
  { meta: "内容创作", title: "文档转小红书图文", body: "从文档中提炼内容，生成适合小红书的标题、正文、封面文案与配图方向。", icon: "doc" },
  { meta: "内容创作", title: "公众号文章排版", body: "围绕主题或草稿，整理长文结构、润色表达，并完成适合公众号阅读的排版。", icon: "layout" },
  { meta: "视频创作", title: "营销视频生成", body: "上传产品图、脚本或素材，一键生成产品视频、直播话术、短视频广告与自媒体视频方案。", icon: "video" },
  { meta: "图像创意", title: "电商详情页生成", body: "围绕产品卖点与目标人群，整理详情页结构、主图文案、营销海报与视觉内容。", icon: "bolt" },
  { meta: "办公日常", title: "PPT 生成与编辑", body: "围绕汇报主题或业务目标，生成 PPT 大纲、页面内容与汇报表达，并支持持续编辑。", icon: "slides" },
  { meta: "办公日常", title: "调研报告生成", body: "围绕行业、竞品、产品或市场问题，形成调研报告、竞品分析与方案文档。", icon: "research" },
];

const TRUST_POINTS = [
  { n: "1", title: "AI 创作", body: "官方技能覆盖高频场景，从文档到视频一步出可交付结果。" },
  { n: "2", title: "AI 协同", body: "一人也能拥有一支 AI 部门：办公日常、内容创作、图像创意、视频创作、音乐制作同台协作。" },
  { n: "3", title: "AI 赋能", body: "统一入口降低试错成本，把能力接到真实业务路径，而不是散落在多个工具站。" },
] as const;

const PROOF_ROWS = [
  { label: "价值层", value: "创作 / 协同 / 赋能" },
  { label: "场景层", value: "办公日常 · 内容 · 图像创意 · 视频创作 · 音乐制作" },
  { label: "技能层", value: "六项官方技能 + 技能商店" },
  { label: "账号", value: "一套登录，全场景共用" },
] as const;

export function SiteHomeV2Content({
  showcaseTemplates,
  authSlot,
  isLoggedIn,
}: {
  showcaseTemplates: QrTemplateJson[];
  authSlot: React.ReactNode;
  isLoggedIn: boolean;
}) {
  const anchor = (hash: string) => `/home-v2${hash}`;

  return (
    <div data-site-home-v2>
      <SiteHomeV2Nav isLoggedIn={isLoggedIn} authSlot={authSlot} />
      <SiteHomeV2Motion />

      <main>
        <section
          id="top"
          className="home-v2-chapter home-v2-hero band-dark"
          aria-labelledby="hero-title"
        >
          <div className="home-v2-copy-narrow">
            <div className="hero-copy">
              <h1 id="hero-title">
                <span className="hero-title-brand">智选</span>
                <span className="hero-title-divider" aria-hidden />
                <br className="hero-title-break" aria-hidden />
                <span className="hero-title-rest">办公・图像・视频・音乐全链路 AI 创作台</span>
              </h1>
              <ul className="value-row" aria-label="平台价值">
                <li>AI 创作</li>
                <li>AI 协同</li>
                <li>AI 赋能</li>
              </ul>
              <div className="hero-actions">
                <Link className="btn-pill" href={anchor(HOME_V2_ANCHORS.skills)}>
                  开始创作
                </Link>
                <Link className="btn-pill btn-pill-secondary" href={anchor(HOME_V2_ANCHORS.scenes)}>
                  浏览场景
                </Link>
              </div>
            </div>
          </div>
          <div className="home-v2-rail hero-stage">
            <div className="hero-visual">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={HOME_V2_MEDIA.hero.src}
                alt={HOME_V2_MEDIA.hero.alt}
                width={HOME_V2_MEDIA.hero.width}
                height={HOME_V2_MEDIA.hero.height}
                decoding="async"
                fetchPriority="high"
              />
              <aside className="workbench" aria-label="工作流产品预览">
                <div className="workbench-head">
                  <div className="workbench-title">
                    <strong>智选工作台</strong>
                    <span>示意界面 · 非线上截图</span>
                  </div>
                  <span className="status-pill">可用</span>
                </div>
                <div className="workbench-flow" aria-hidden>
                  <div className="flow-step">
                    <span className="step-num">01</span>
                    <strong>选场景</strong>
                    <span>办公日常 / 内容 / 图像创意 / 视频创作 / 音乐制作</span>
                  </div>
                  <div className="flow-step">
                    <span className="step-num">02</span>
                    <strong>用技能</strong>
                    <span>官方技能直接开做</span>
                  </div>
                  <div className="flow-step">
                    <span className="step-num">03</span>
                    <strong>出结果</strong>
                    <span>可编辑、可交付</span>
                  </div>
                </div>
                <SiteHomeV2HeroWorkbenchBody />
              </aside>
            </div>
          </div>
        </section>

        <section
          id="scenes"
          className="home-v2-chapter home-v2-chapter-pad band-soft"
          aria-labelledby="scenes-title"
        >
          <div className="home-v2-rail">
            <div className="section-head center">
              <h2 id="scenes-title">办公到多模态，一条入口覆盖</h2>
              <p className="lead">
                按你要完成的事进入：办公日常、内容产出、图像创意、视频创作、音乐制作——统一账号，统一工作台。
              </p>
            </div>
            <div className="module-grid" id="scene-grid">
              {SCENES.map((scene) => (
                <article key={scene.title} className={`module-tile ${scene.variant}`}>
                  <div className="module-copy">
                    <h3>{scene.title}</h3>
                    <p>{scene.body}</p>
                    <div className="module-links">
                      <TextLinkArrow
                        href={
                          scene.link.external
                            ? scene.link.href
                            : anchor(scene.link.href)
                        }
                        external={scene.link.external}
                      >
                        {scene.link.label}
                      </TextLinkArrow>
                    </div>
                  </div>
                  <div className="module-media">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="od-media"
                      src={scene.media.src}
                      alt={scene.media.alt}
                      width={scene.media.width}
                      height={scene.media.height}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="skills"
          className="home-v2-chapter home-v2-chapter-pad band-light"
          aria-labelledby="skills-title"
        >
          <div className="home-v2-copy-narrow">
            <div className="section-head center">
              <HomeV2SkillsHeadIcon />
              <h2 id="skills-title">官方 AI 技能，覆盖高频创作场景</h2>
              <p className="lead">别再把 AI 当成单点能力，一个人也可以拥有一个 AI 部门。</p>
            </div>
          </div>
          <div className="home-v2-rail">
            <div className="module-grid" id="skill-grid">
              {SKILLS.map((skill) => (
                <article key={skill.title} className="module-tile skill-tile">
                  <div className="module-copy">
                    <div className="skill-icon" aria-hidden>
                      <HomeV2SkillIcon name={skill.icon} />
                    </div>
                    <div>
                      <p className="skill-meta">{skill.meta}</p>
                      <h3>{skill.title}</h3>
                    </div>
                    <p>{skill.body}</p>
                    <TextLinkArrow href={anchor(HOME_V2_ANCHORS.cta)} external={false}>
                      了解更多
                    </TextLinkArrow>
                  </div>
                </article>
              ))}
            </div>
            <div className="store-bar">
              <div>
                <h3>探索更多技能</h3>
                <p>写作、设计、排版、调研、电商等 AI 技能持续上架，按场景在技能商店里继续找。</p>
              </div>
              <a className="btn-pill btn-dark" href={homeV2ToolHref()} {...BOOK_PORTAL_EXTERNAL_LINK_PROPS}>
                前往技能商店 →
              </a>
            </div>
          </div>
        </section>

        <section
          id="quick-replica-showcase"
          className="home-v2-chapter home-v2-chapter-pad band-soft"
          aria-labelledby="qr-showcase-title"
        >
          <div className="home-v2-rail">
            <div className="section-head center">
              <h2 id="qr-showcase-title">从广场精选作品开始</h2>
              <p className="lead">
                点击作品带模板进入快速复刻，沿用官方参数与参考图，改文案即可开跑。
              </p>
            </div>
            {showcaseTemplates.length > 0 ? (
              <div className="qr-showcase-grid">
                {showcaseTemplates.map((t) => (
                  <a
                    key={t.id}
                    className="qr-showcase-tile"
                    href={homeV2QuickReplicaHref(t.id)}
                    {...BOOK_PORTAL_EXTERNAL_LINK_PROPS}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="qr-showcase-thumb"
                      src={t.thumbnailUrl!}
                      alt={t.title || "复刻模板"}
                      loading="lazy"
                      decoding="async"
                    />
                    <p className="qr-showcase-title">{t.title || "未命名模板"}</p>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-[var(--muted)]">
                暂无广场作品，请稍后再来或{" "}
                <a href={homeV2QuickReplicaHref()} {...BOOK_PORTAL_EXTERNAL_LINK_PROPS}>
                  打开快速复刻
                </a>
                。
              </p>
            )}
            <p className="mt-6 text-center">
              <a
                className="btn-pill btn-pill-secondary"
                href={homeV2QuickReplicaHref()}
                {...BOOK_PORTAL_EXTERNAL_LINK_PROPS}
              >
                浏览全部作品
              </a>
            </p>
          </div>
        </section>

        <section
          id="why"
          className="home-v2-chapter home-v2-chapter-pad band-soft"
          aria-labelledby="why-title"
        >
          <div className="home-v2-rail trust-grid">
            <div>
              <div className="section-head">
                <p className="section-kicker">为什么是智选</p>
                <h2 id="why-title">创作、协同、赋能，同一套能力</h2>
                <p className="lead">
                  用可验证的差异建立信任：统一账号、场景清晰、技能可落地——而不是模板好评轮播。
                </p>
              </div>
              <div className="trust-points">
                {TRUST_POINTS.map((item) => (
                  <article key={item.n} className="trust-point">
                    <div className="num" aria-hidden>
                      {item.n}
                    </div>
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.body}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <aside className="proof-panel" aria-label="能力摘要">
              <p className="section-kicker">能力摘要</p>
              <h3>五场景 + 官方技能，同一工作台</h3>
              <p>以下为结构示意，具体价目与额度以正式站点为准；本原型不编造价格或用量承诺。</p>
              <div className="proof-rows">
                {PROOF_ROWS.map((row) => (
                  <div key={row.label} className="proof-row">
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>
              <Link className="btn-pill" href={anchor(HOME_V2_ANCHORS.skills)}>
                开始创作
              </Link>
            </aside>
          </div>
        </section>

        <section
          id="cta"
          className="home-v2-chapter home-v2-chapter-pad band-light"
          aria-labelledby="cta-title"
        >
          <div className="home-v2-copy-narrow">
            <div className="cta-card">
              <h2 id="cta-title">选一个场景，开始用智选</h2>
              <p className="lead mx-auto">
                从官方技能上手，或去技能商店找更多能力。主线只有一条：全链路 AI 创作，直接出结果。
              </p>
              <div className="pricing-anchors" id="pricing">
                <div className="pricing-card">
                  <h3 className="text-lg">会员订阅</h3>
                  <p className="text-sm text-[var(--muted)]">
                    统一账号开通场景与技能；具体价目以线上订阅页为准。
                  </p>
                  <Link className="text-link mt-2 inline-block" href={HOME_V2_ANCHORS.pricing}>
                    订阅价格 →
                  </Link>
                </div>
                <div className="pricing-card" id="api-pricing">
                  <h3 className="text-lg">开发者 API</h3>
                  <p className="text-sm text-[var(--muted)]">
                    按调用接入模型与能力；价目与配额以 API 文档为准。
                  </p>
                  <Link className="text-link mt-2 inline-block" href={HOME_V2_ANCHORS.apiPricing}>
                    API 价格 →
                  </Link>
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <Link className="btn-pill" href={anchor(HOME_V2_ANCHORS.skills)}>
                  查看官方技能
                </Link>
                <Link className="btn-pill btn-pill-secondary" href={anchor(HOME_V2_ANCHORS.scenes)}>
                  浏览五大场景
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="home-v2-rail">
          <div className="footer-grid">
            <div className="footer-brand">
              <Link className="brand" href={anchor(HOME_V2_ANCHORS.top)}>
                <span className="brand-mark" aria-hidden>
                  智
                </span>
                <span className="brand-name">智选</span>
              </Link>
              <p>
                智选｜办公・图像・视频・音乐全链路 AI 创作台。价值层是创作、协同、赋能；场景覆盖办公日常、内容创作、图像创意、视频创作与音乐制作。
              </p>
            </div>
            <div className="footer-col">
              <h4>场景</h4>
              <ul>
                <li>
                  <Link href={anchor(HOME_V2_ANCHORS.scenes)}>办公日常</Link>
                </li>
                <li>
                  <Link href={anchor(HOME_V2_ANCHORS.scenes)}>内容创作</Link>
                </li>
                <li>
                  <Link href={anchor(HOME_V2_ANCHORS.scenes)}>
                    图像创意 / 视频创作 / 音乐制作
                  </Link>
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>技能</h4>
              <ul>
                <li>
                  <Link href={anchor(HOME_V2_ANCHORS.skills)}>官方技能</Link>
                </li>
                <li>
                  <Link href={anchor(HOME_V2_ANCHORS.cta)}>技能商店</Link>
                </li>
                <li>
                  <Link href={anchor(HOME_V2_ANCHORS.why)}>平台差异</Link>
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>支持</h4>
              <ul>
                <li>
                  <Link href={anchor(HOME_V2_ANCHORS.cta)}>开始创作</Link>
                </li>
                <li>
                  <Link href={anchor(HOME_V2_ANCHORS.top)}>回到顶部</Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>智选 · 主页改版原型</span>
            <span>语境参考 book.ai-code8.com · 视觉方向 Apple · 通栏等宽</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
