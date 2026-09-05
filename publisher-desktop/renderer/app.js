const api = window.publisherDesktop;

const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5z"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 5 5-9"/></svg>',
  draft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>',
  history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  dynamic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>',
  video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="m10 9 6 4-6 4V9z"/></svg>',
  article: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/></svg>',
  podcast: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
  proxy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><circle cx="18" cy="6" r="3"/><path d="M8.6 7.4 15.4 16.6"/><path d="M15.4 7.4 8.6 16.6"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  feedback: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
};

const NAV = [
  { id: "home", label: "首页", icon: "home" },
  { id: "accounts", label: "账号", icon: "users" },
  { id: "data", label: "数据", icon: "chart" },
  { id: "drafts", label: "草稿", icon: "draft" },
  { id: "history", label: "历史", icon: "history" },
  { section: "发布" },
  { id: "publish-dynamic", label: "发布动态", icon: "dynamic" },
  { id: "publish-video", label: "发布视频", icon: "video" },
  { id: "publish-article", label: "发布文章", icon: "article" },
  { id: "publish-podcast", label: "发布播客", icon: "podcast" },
  { section: "系统" },
  { id: "settings", label: "设置", icon: "settings" },
  { id: "proxy", label: "代理", icon: "proxy" },
  { id: "about", label: "关于", icon: "info" },
  { id: "feedback", label: "反馈", icon: "feedback" },
];

let currentRoute = "home";
let auth = null;
let accounts = [];
let accountPlatformFilter = "all";
let accountStatusFilter = "all";
let accountSearch = "";
let modalSelectedPlatform = null;
let modalContentFilter = "all";
let modalPlatformSearch = "";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "早上好";
  if (h < 18) return "下午好";
  return "晚上好";
}

function onboardingDismissed() {
  return localStorage.getItem("publisher_onboarding_dismissed") === "1";
}

function dismissOnboarding() {
  localStorage.setItem("publisher_onboarding_dismissed", "1");
  render();
}

function navigate(route) {
  currentRoute = route;
  renderSidebar();
  render();
}

function renderSidebar() {
  const nav = document.getElementById("sidebar-nav");
  nav.innerHTML = NAV.map((item) => {
    if (item.section) {
      return `<div class="nav-section-title">${item.section}</div>`;
    }
    const active = item.id === currentRoute ? " active" : "";
    return `<button type="button" class="nav-item${active}" data-route="${item.id}">
      ${ICONS[item.icon] || ""}
      <span class="nav-label">${item.label}</span>
    </button>`;
  }).join("");

  nav.querySelectorAll("[data-route]").forEach((btn) => {
    btn.addEventListener("click", () => navigate(btn.dataset.route));
  });
}

function accountStats() {
  const total = accounts.length;
  const online = accounts.filter((a) => a.loginStatus === "logged_in").length;
  const needsRelogin = accounts.filter((a) => a.loginStatus === "needs_relogin").length;
  return { total, online, needsRelogin };
}

function filteredAccounts() {
  return accounts.filter((a) => {
    if (accountPlatformFilter !== "all" && a.platformId !== accountPlatformFilter) return false;
    if (accountStatusFilter !== "all" && a.loginStatus !== accountStatusFilter) return false;
    if (accountSearch) {
      const q = accountSearch.toLowerCase();
      const platform = getPlatformById(a.platformId);
      const hay = `${a.label} ${platform?.label ?? a.platformId}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function platformCounts() {
  const map = { all: accounts.length };
  for (const a of accounts) {
    map[a.platformId] = (map[a.platformId] || 0) + 1;
  }
  return map;
}

function renderAuthBanner() {
  if (auth) return "";
  return `<div class="auth-banner warn">
    <span>尚未登录 Book 账号，发布任务与会员准入需先完成登录。</span>
    <button type="button" class="btn-primary" id="banner-login">登录</button>
  </div>`;
}

function renderHome() {
  const stats = accountStats();
  const showOnboarding = !onboardingDismissed();

  return `
    <div class="main-scroll">
      ${renderAuthBanner()}
      <header class="page-header">
        <h1>${greeting()}</h1>
        <p>把内容一键发布到各平台，今天想发点什么？</p>
      </header>

      ${
        showOnboarding
          ? `<section class="onboarding">
        <button type="button" class="onboarding-close" id="onboarding-close" aria-label="关闭">✕</button>
        <h2>三步上手一键发布</h2>
        <div class="onboarding-steps">
          <div class="onboarding-step">
            <h3>1. 添加账号</h3>
            <p>为每个平台账号创建独立会话分区，并在浏览器窗口中登录该平台。</p>
            <button type="button" class="link-btn" data-go="accounts" data-open-add="1">去添加 →</button>
          </div>
          <div class="onboarding-step">
            <h3>2. 创作内容</h3>
            <p>选择动态、视频或文章格式，填写文案与素材（发布页开发中）。</p>
            <button type="button" class="link-btn" data-go="publish-dynamic">去创作 →</button>
          </div>
          <div class="onboarding-step">
            <h3>3. 一键发布</h3>
            <p>勾选目标账号，批量分发到多个平台（V1 脚本持续完善中）。</p>
            <button type="button" class="link-btn" data-go="publish-dynamic">试一试 →</button>
          </div>
        </div>
      </section>`
          : ""
      }

      <div class="card-grid-4">
        <button type="button" class="action-card" data-go="publish-dynamic">
          <h3>发布动态</h3>
          <p>图文动态一键多发</p>
        </button>
        <button type="button" class="action-card" data-go="publish-video">
          <h3>发布视频</h3>
          <p>视频分发到各平台</p>
        </button>
        <button type="button" class="action-card" data-go="publish-article">
          <h3>发布文章</h3>
          <p>长文章同步发布</p>
        </button>
        <button type="button" class="action-card" data-go="publish-podcast">
          <h3>发布播客</h3>
          <p>音频节目多平台上架</p>
        </button>
      </div>

      <div class="card-grid-2">
        <div class="card">
          <div class="widget-header">
            <h3>我的账号</h3>
            <button type="button" class="widget-link" data-go="accounts">管理 →</button>
          </div>
          ${
            stats.total === 0
              ? `<p class="empty-state">还没有添加平台账号</p>
                 <button type="button" class="btn-primary" id="home-add-account">添加账号</button>`
              : `<p>共 ${stats.total} 个账号，${stats.online} 个在线</p>
                 ${
                   stats.needsRelogin > 0
                     ? `<p class="alert-inline">${stats.needsRelogin} 个账号需要重新登录 →</p>`
                     : ""
                 }`
          }
        </div>
        <div class="card">
          <div class="widget-header">
            <h3>最近发布</h3>
            <button type="button" class="widget-link" data-go="history">全部 →</button>
          </div>
          <p class="empty-state">还没有发布记录</p>
        </div>
      </div>

      <div class="support-bar">
        <p>遇到问题？有任何使用问题或想支持新平台，随时反馈，我们会尽快帮你处理。</p>
        <div class="support-actions">
          <button type="button" class="btn-ghost" data-go="feedback">联系我们</button>
          <button type="button" class="btn-ghost" id="support-email">支持邮箱</button>
          <button type="button" class="btn-ghost" data-go="about">帮助文档</button>
        </div>
      </div>
    </div>
  `;
}

function loginStatusLabel(status) {
  if (status === "logged_in") return { text: "已登录", dot: "status-dot" };
  if (status === "needs_relogin") return { text: "需重新登录", dot: "status-dot warn" };
  return { text: "未检测", dot: "status-dot off" };
}

function renderAccountsTable(rows) {
  if (rows.length === 0) {
    return `<p class="empty-state">暂无账号，点击右上角「添加账号」开始。</p>`;
  }

  return `<table class="data-table">
    <thead>
      <tr>
        <th>账号信息</th>
        <th>平台</th>
        <th>分组</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map((a) => {
          const platform = getPlatformById(a.platformId);
          const st = loginStatusLabel(a.loginStatus);
          const color = platform?.color ?? "#444";
          const short = (platform?.label ?? a.platformId).slice(0, 2);
          return `<tr data-account-id="${a.id}">
            <td>
              <div class="account-cell">
                <div class="account-avatar" style="background:${color}22;color:${color}">${short}</div>
                <div>
                  <div class="account-name">${escapeHtml(a.label)}</div>
                  <div class="account-status">
                    <span class="${st.dot}"></span>
                    <span>${st.text}</span>
                    <button type="button" class="relogin-link" data-relogin="${a.id}">重新登录</button>
                  </div>
                </div>
              </div>
            </td>
            <td>${escapeHtml(platform?.label ?? a.platformId)}</td>
            <td><span class="select-input" style="display:inline-block;padding:4px 8px;font-size:12px">未分组</span></td>
            <td>
              <div class="row-actions">
                <button type="button" class="icon-btn" title="重新登录" data-relogin="${a.id}">↻</button>
                <button type="button" class="icon-btn danger" title="删除" data-delete="${a.id}">🗑</button>
              </div>
            </td>
          </tr>`;
        })
        .join("")}
    </tbody>
  </table>`;
}

function renderAccounts() {
  const counts = platformCounts();
  const rows = filteredAccounts();
  const stats = accountStats();
  const platformsWithAccounts = [...new Set(accounts.map((a) => a.platformId))];

  const filterItems = [
    `<button type="button" class="filter-item${accountPlatformFilter === "all" ? " active" : ""}" data-platform-filter="all">
      全部平台 <span class="count">${counts.all || 0}</span>
    </button>`,
    ...platformsWithAccounts.map((pid) => {
      const p = getPlatformById(pid);
      return `<button type="button" class="filter-item${accountPlatformFilter === pid ? " active" : ""}" data-platform-filter="${pid}">
        ${escapeHtml(p?.label ?? pid)} <span class="count">${counts[pid] || 0}</span>
      </button>`;
    }),
  ].join("");

  return `
    <div class="accounts-layout">
      <aside class="accounts-filter">
        <input type="search" class="search-input" id="filter-platform-search" placeholder="搜索平台" />
        <div class="filter-group-title">平台</div>
        ${filterItems}
        <div class="filter-group-title">分组</div>
        <button type="button" class="filter-item active">全部分组</button>
        <button type="button" class="filter-item" disabled style="opacity:0.5">暂无分组</button>
      </aside>
      <div class="accounts-main">
        <header class="page-header">
          <h1>账号管理</h1>
          <p>${stats.total} 个账号 · ${stats.online} 个已登录 · ${platformsWithAccounts.length} 个平台</p>
        </header>
        <div class="accounts-toolbar">
          <select class="select-input" id="account-status-filter">
            <option value="all">全部状态</option>
            <option value="logged_in">已登录</option>
            <option value="needs_relogin">需重新登录</option>
            <option value="unknown">未检测</option>
          </select>
          <input type="search" class="search-input" id="account-name-search" placeholder="搜索账号名称" value="${escapeHtml(accountSearch)}" />
          <div class="accounts-toolbar-spacer"></div>
          <button type="button" class="btn-ghost" id="btn-check-all">检测全部</button>
          <button type="button" class="btn-primary" id="btn-open-add-modal">+ 添加账号</button>
        </div>
        ${renderAccountsTable(rows)}
      </div>
    </div>
  `;
}

function renderPlaceholder(title, desc) {
  return `<div class="main-scroll">
    ${renderAuthBanner()}
    <div class="placeholder-page">
      <h2>${title}</h2>
      <p>${desc}</p>
      <button type="button" class="btn-ghost" data-go="home">返回首页</button>
    </div>
  </div>`;
}

function renderSettings() {
  return `<div class="main-scroll">
    ${renderAuthBanner()}
    <header class="page-header">
      <h1>设置</h1>
      <p>Book 账号与客户端偏好</p>
    </header>
    <div class="card" style="max-width:480px">
      <h3 style="margin:0 0 8px;font-size:15px">Book 账号</h3>
      <p style="color:var(--text-muted);font-size:13px;margin:0 0 16px">
        ${auth ? `已登录 · 用户 ${auth.userId.slice(0, 12)}…` : "未登录"}
      </p>
      <div style="display:flex;gap:8px">
        <button type="button" class="btn-primary" id="settings-login">${auth ? "重新登录" : "登录"}</button>
        ${auth ? '<button type="button" class="btn-ghost" id="settings-logout">退出登录</button>' : ""}
      </div>
    </div>
  </div>`;
}

function renderAbout() {
  return `<div class="main-scroll">
    <header class="page-header">
      <h1>关于</h1>
      <p>一键发布桌面端 · V1 公开测试</p>
    </header>
    <div class="card" style="max-width:560px">
      <p style="margin:0 0 12px;color:var(--text-muted);font-size:13px;line-height:1.7">
        桌面端用于多平台账号矩阵管理：每个平台账号使用独立 Electron 会话分区，登录态与浏览器扩展不互通。
        V1 支持小红书、抖音、微博、B 站、微信公众号；发布脚本与任务派发持续完善中。
      </p>
      <p style="margin:0;font-size:13px">
        下载页：<a href="#" id="open-download">book 站 /publisher/download</a>
      </p>
    </div>
  </div>`;
}

function renderFeedback() {
  return `<div class="main-scroll">
    <header class="page-header">
      <h1>反馈</h1>
      <p>问题与平台需求欢迎告诉我们</p>
    </header>
    <div class="card" style="max-width:480px">
      <p style="margin:0 0 16px;color:var(--text-muted);font-size:13px">
        请发送邮件至 support@ai-code8.com，标题注明「一键发布桌面端」。
      </p>
      <button type="button" class="btn-primary" id="feedback-email">打开邮件客户端</button>
    </div>
  </div>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMainContent() {
  switch (currentRoute) {
    case "home":
      return renderHome();
    case "accounts":
      return renderAccounts();
    case "settings":
      return renderSettings();
    case "about":
      return renderAbout();
    case "feedback":
      return renderFeedback();
    case "data":
      return renderPlaceholder("数据", "各平台阅读与互动数据汇总开发中。");
    case "drafts":
      return renderPlaceholder("草稿", "草稿箱将在发布流程完善后开放。");
    case "history":
      return renderPlaceholder("历史", "发布历史记录开发中。");
    case "publish-dynamic":
      return renderPlaceholder("发布动态", "动态发布表单开发中；可先添加账号并完成平台登录。");
    case "publish-video":
      return renderPlaceholder("发布视频", "视频发布表单开发中。");
    case "publish-article":
      return renderPlaceholder("发布文章", "文章发布表单开发中。");
    case "publish-podcast":
      return renderPlaceholder("发布播客", "播客发布暂未纳入 V1 范围。");
    case "proxy":
      return renderPlaceholder("代理", "代理池与账号绑定将在后续版本开放。");
    default:
      return renderHome();
  }
}

function render() {
  document.getElementById("main-root").innerHTML = renderMainContent();
  bindMainEvents();
  if (currentRoute === "accounts") bindAccountEvents();
}

function bindMainEvents() {
  document.querySelectorAll("[data-go]").forEach((el) => {
    el.addEventListener("click", () => {
      const route = el.dataset.go;
      const openAdd = el.dataset.openAdd === "1";
      navigate(route);
      if (openAdd) setTimeout(openAddAccountModal, 0);
    });
  });

  document.getElementById("onboarding-close")?.addEventListener("click", dismissOnboarding);
  document.getElementById("home-add-account")?.addEventListener("click", () => {
    navigate("accounts");
    setTimeout(openAddAccountModal, 0);
  });
  document.getElementById("banner-login")?.addEventListener("click", () => api.openLogin());
  document.getElementById("settings-login")?.addEventListener("click", () => api.openLogin());
  document.getElementById("settings-logout")?.addEventListener("click", async () => {
    await api.logout();
    auth = null;
    render();
  });
  document.getElementById("support-email")?.addEventListener("click", () => {
    api.openExternal?.("mailto:support@ai-code8.com?subject=一键发布桌面端");
  });
  document.getElementById("feedback-email")?.addEventListener("click", () => {
    api.openExternal?.("mailto:support@ai-code8.com?subject=一键发布反馈");
  });
  document.getElementById("open-download")?.addEventListener("click", (e) => {
    e.preventDefault();
    api.openExternal?.("http://localhost:3000/publisher/download");
  });
}

function bindAccountEvents() {
  document.getElementById("btn-open-add-modal")?.addEventListener("click", openAddAccountModal);
  document.getElementById("btn-check-all")?.addEventListener("click", async () => {
    accounts = await api.checkAllAccounts();
    render();
  });

  document.getElementById("account-status-filter")?.addEventListener("change", (e) => {
    accountStatusFilter = e.target.value;
    render();
  });

  document.getElementById("account-name-search")?.addEventListener("input", (e) => {
    accountSearch = e.target.value;
    render();
  });

  document.querySelectorAll("[data-platform-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      accountPlatformFilter = btn.dataset.platformFilter;
      render();
    });
  });

  document.querySelectorAll("[data-relogin]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api.openAccountLogin(btn.dataset.relogin);
      accounts = await api.listAccounts();
      render();
    });
  });

  document.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("确定删除此平台账号？分区登录态将保留直到手动清理。")) return;
      accounts = await api.removeAccount(btn.dataset.delete);
      render();
    });
  });
}

/* ---- Add account modal ---- */

function openAddAccountModal() {
  modalSelectedPlatform = null;
  modalContentFilter = "all";
  modalPlatformSearch = "";
  document.getElementById("modal-platform-search").value = "";
  updateModal();
  document.getElementById("modal-add-account").classList.remove("hidden");
}

function closeAddAccountModal() {
  document.getElementById("modal-add-account").classList.add("hidden");
  modalSelectedPlatform = null;
}

function updateModalSubmitState() {
  const enabled = Boolean(modalSelectedPlatform);
  document.getElementById("modal-add-submit").disabled = !enabled;
  document.getElementById("modal-add-continue").disabled = !enabled;
}

function filteredModalPlatforms() {
  return PUBLISHER_PLATFORM_CATALOG.filter((p) => {
    if (modalContentFilter !== "all" && !p.contentTypes.includes(modalContentFilter)) return false;
    if (modalPlatformSearch) {
      const q = modalPlatformSearch.toLowerCase();
      if (!`${p.label} ${p.en} ${p.id}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

function renderModalPlatformSections() {
  const list = filteredModalPlatforms();
  const common = list.filter((p) => p.category === "common");
  const domestic = list.filter((p) => p.category === "domestic");

  const tile = (p) => {
    const selected = modalSelectedPlatform === p.id ? " selected" : "";
    const tags = p.contentTypes
      .map((t) => `<span class="platform-tag">${CONTENT_TYPE_LABELS[t] || t}</span>`)
      .join("");
    return `<button type="button" class="platform-tile${selected}" data-platform-id="${p.id}" ${p.v1 ? "" : "disabled title=\"即将支持\""}>
      <div class="platform-tile-icon" style="background:${p.color}22;color:${p.color}">${p.label.slice(0, 1)}</div>
      <div class="platform-tile-name">${escapeHtml(p.label)}</div>
      <div class="platform-tile-en">${escapeHtml(p.en)}</div>
      <div class="platform-tags">${tags}</div>
    </button>`;
  };

  let html = "";
  if (common.length) {
    html += `<div class="platform-section-title">常用平台（${common.length}）</div><div class="platform-grid">${common.map(tile).join("")}</div>`;
  }
  if (domestic.length) {
    html += `<div class="platform-section-title">国内社交（${domestic.length}）</div><div class="platform-grid">${domestic.map(tile).join("")}</div>`;
  }
  if (!html) {
    html = `<p class="empty-state">没有匹配的平台</p>`;
  }
  document.getElementById("modal-platform-sections").innerHTML = html;

  document.querySelectorAll(".platform-tile[data-platform-id]").forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener("click", () => {
      modalSelectedPlatform = btn.dataset.platformId;
      updateModal();
    });
  });
}

function renderModalContentFilters() {
  const chips = [
    { id: "all", label: "全部" },
    { id: "dynamic", label: "动态" },
    { id: "video", label: "视频" },
    { id: "article", label: "文章" },
    { id: "podcast", label: "播客" },
  ];
  document.getElementById("modal-content-filters").innerHTML = chips
    .map(
      (c) =>
        `<button type="button" class="chip${modalContentFilter === c.id ? " active" : ""}" data-content-filter="${c.id}">${c.label}</button>`,
    )
    .join("");

  document.querySelectorAll("[data-content-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      modalContentFilter = btn.dataset.contentFilter;
      updateModal();
    });
  });
}

function updateModal() {
  renderModalContentFilters();
  renderModalPlatformSections();
  updateModalSubmitState();
}

async function submitAddAccount(continueAdding) {
  if (!modalSelectedPlatform) return;
  const platform = getPlatformById(modalSelectedPlatform);
  const label = `${platform?.label ?? modalSelectedPlatform}_user`;
  accounts = await api.addAccount(modalSelectedPlatform, label);
  const created = accounts[accounts.length - 1];
  if (created) {
    await api.openAccountLogin(created.id);
    accounts = await api.listAccounts();
  }
  if (continueAdding) {
    modalSelectedPlatform = null;
    updateModal();
    render();
  } else {
    closeAddAccountModal();
    navigate("accounts");
    render();
  }
}

function initModal() {
  document.getElementById("modal-add-close").addEventListener("click", closeAddAccountModal);
  document.getElementById("modal-add-cancel").addEventListener("click", closeAddAccountModal);
  document.getElementById("modal-add-submit").addEventListener("click", () => submitAddAccount(false));
  document.getElementById("modal-add-continue").addEventListener("click", () => submitAddAccount(true));
  document.getElementById("modal-platform-search").addEventListener("input", (e) => {
    modalPlatformSearch = e.target.value;
    updateModal();
  });
  document.getElementById("modal-add-account").addEventListener("click", (e) => {
    if (e.target.id === "modal-add-account") closeAddAccountModal();
  });
}

async function refreshAuth() {
  auth = await api.getAuth();
}

async function refreshAccounts() {
  accounts = await api.listAccounts();
}

async function init() {
  renderSidebar();
  initModal();
  document.getElementById("btn-collapse").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("collapsed");
  });

  api.onAuthUpdated?.((next) => {
    auth = next;
    render();
  });

  api.onAccountsUpdated?.((list) => {
    accounts = list;
    render();
  });

  await refreshAuth();
  await refreshAccounts();
  render();
}

init();
