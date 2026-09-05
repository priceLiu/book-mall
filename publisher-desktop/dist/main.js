"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/main.ts
var import_electron = require("electron");
var http = __toESM(require("node:http"));
var path = __toESM(require("node:path"));
var fs = __toESM(require("node:fs"));

// node_modules/.pnpm/@private+publisher-client@file+..+shared+publisher-client/node_modules/@private/publisher-client/index.ts
function buildClientLoginUrl(publisherOrigin, client, redirectPath = "/auth/client-callback", loopback) {
  const base = publisherOrigin.replace(/\/$/, "");
  const params = new URLSearchParams({
    client,
    redirect: redirectPath
  });
  if (loopback) params.set("loopback", loopback);
  return `${base}/login?${params.toString()}`;
}

// node_modules/.pnpm/@private+publisher-sync-core@file+..+shared+publisher-sync-core/node_modules/@private/publisher-sync-core/index.ts
var V1_PLATFORMS = [
  {
    id: "xiaohongshu",
    label: "\u5C0F\u7EA2\u4E66",
    contentTypes: ["dynamic", "video"],
    publishUrl: "https://creator.xiaohongshu.com/publish/publish"
  },
  {
    id: "douyin",
    label: "\u6296\u97F3",
    contentTypes: ["dynamic", "video"],
    publishUrl: "https://creator.douyin.com/creator-micro/content/upload"
  },
  {
    id: "weibo",
    label: "\u5FAE\u535A",
    contentTypes: ["dynamic", "article", "video"],
    publishUrl: "https://weibo.com"
  },
  {
    id: "bilibili",
    label: "B\u7AD9",
    contentTypes: ["article", "video"],
    publishUrl: "https://member.bilibili.com/platform/upload/text/edit"
  },
  {
    id: "wechat_mp",
    label: "\u5FAE\u4FE1\u516C\u4F17\u53F7",
    contentTypes: ["article", "dynamic"],
    semiAuto: true,
    publishUrl: "https://mp.weixin.qq.com/"
  }
];
function getPlatformMeta(id) {
  return V1_PLATFORMS.find((p) => p.id === id);
}

// src/main.ts
var PUBLISHER_WEB = process.env.PUBLISHER_WEB_ORIGIN?.trim() || "http://localhost:3011";
var BOOK_ORIGIN = process.env.BOOK_ORIGIN?.trim() || "http://localhost:3000";
var mainWindow = null;
var accounts = [];
function authFilePath() {
  return path.join(import_electron.app.getPath("userData"), "auth.bin");
}
function accountsFilePath() {
  return path.join(import_electron.app.getPath("userData"), "accounts.json");
}
function loadAuth() {
  try {
    const file = authFilePath();
    if (!fs.existsSync(file)) return null;
    const buf = fs.readFileSync(file);
    if (!import_electron.safeStorage.isEncryptionAvailable()) {
      return JSON.parse(buf.toString("utf8"));
    }
    return JSON.parse(import_electron.safeStorage.decryptString(buf));
  } catch {
    return null;
  }
}
function saveAuth(auth) {
  const file = authFilePath();
  if (!auth) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return;
  }
  const raw = JSON.stringify(auth);
  const buf = import_electron.safeStorage.isEncryptionAvailable() ? import_electron.safeStorage.encryptString(raw) : Buffer.from(raw, "utf8");
  fs.writeFileSync(file, buf);
}
function loadAccountsFromDisk() {
  try {
    const file = accountsFilePath();
    if (!fs.existsSync(file)) return [];
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function saveAccountsToDisk() {
  fs.writeFileSync(accountsFilePath(), JSON.stringify(accounts, null, 2), "utf8");
}
function platformLoginUrl(platformId) {
  const meta = getPlatformMeta(platformId);
  if (meta) {
    const loginUrls = {
      xiaohongshu: "https://creator.xiaohongshu.com/",
      douyin: "https://creator.douyin.com/",
      weibo: "https://weibo.com/",
      bilibili: "https://member.bilibili.com/",
      wechat_mp: "https://mp.weixin.qq.com/"
    };
    return loginUrls[platformId] ?? meta.publishUrl;
  }
  return "about:blank";
}
function platformPublishUrl(platformId) {
  return getPlatformMeta(platformId)?.publishUrl ?? "about:blank";
}
function createMainWindow() {
  mainWindow = new import_electron.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#0a0a0a",
    title: "\u4E00\u952E\u53D1\u5E03",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
}
async function refreshAccessToken(refreshToken) {
  const res = await fetch(`${BOOK_ORIGIN}/api/sso/client/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  return {
    accessToken: String(data.access_token),
    refreshToken: String(data.refresh_token),
    expiresAt: Date.now() + Number(data.expires_in) * 1e3,
    deviceId: String(data.device_id),
    userId: String(data.user_id)
  };
}
function openSystemLogin() {
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    if (u.pathname !== "/callback") {
      res.writeHead(404);
      res.end();
      return;
    }
    const access = u.searchParams.get("access_token");
    const refresh = u.searchParams.get("refresh_token");
    const userId = u.searchParams.get("user_id");
    const deviceId = u.searchParams.get("device_id");
    const expiresIn = Number(u.searchParams.get("expires_in") ?? "600");
    if (access && refresh && userId && deviceId) {
      const auth = {
        accessToken: access,
        refreshToken: refresh,
        expiresAt: Date.now() + expiresIn * 1e3,
        deviceId,
        userId
      };
      saveAuth(auth);
      mainWindow?.webContents.send("auth-updated", auth);
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<html><body><p>\u767B\u5F55\u6210\u529F\uFF0C\u53EF\u5173\u95ED\u6B64\u9875\u8FD4\u56DE\u684C\u9762\u7AEF\u3002</p></body></html>");
    server.close();
  });
  server.listen(0, "127.0.0.1", () => {
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    const loopback = `http://127.0.0.1:${port}/callback`;
    const loginUrl = buildClientLoginUrl(PUBLISHER_WEB, "desktop", "/auth/client-callback", loopback);
    import_electron.shell.openExternal(loginUrl);
  });
}
async function detectAccountLoginStatus(acct) {
  try {
    const ses = import_electron.session.fromPartition(acct.partition);
    const cookies = await ses.cookies.get({});
    if (cookies.length === 0) return "needs_relogin";
    return "logged_in";
  } catch {
    return "unknown";
  }
}
import_electron.app.whenReady().then(() => {
  accounts = loadAccountsFromDisk();
  createMainWindow();
  import_electron.ipcMain.handle("get-auth", async () => {
    let auth = loadAuth();
    if (auth && auth.expiresAt < Date.now() + 6e4) {
      auth = await refreshAccessToken(auth.refreshToken);
      saveAuth(auth);
      mainWindow?.webContents.send("auth-updated", auth);
    }
    return auth;
  });
  import_electron.ipcMain.handle("open-login", () => {
    openSystemLogin();
  });
  import_electron.ipcMain.handle("logout", () => {
    saveAuth(null);
    mainWindow?.webContents.send("auth-updated", null);
  });
  import_electron.ipcMain.handle("open-external", (_e, url) => {
    if (typeof url === "string" && /^https?:\/\//.test(url)) {
      import_electron.shell.openExternal(url);
    } else if (typeof url === "string" && url.startsWith("mailto:")) {
      import_electron.shell.openExternal(url);
    }
  });
  import_electron.ipcMain.handle("list-accounts", () => accounts);
  import_electron.ipcMain.handle(
    "add-account",
    (_e, input) => {
      const id = `acct_${Date.now().toString(36)}`;
      const partition = `persist:acct-${id}`;
      accounts.push({
        id,
        platformId: input.platformId,
        label: input.label,
        partition,
        group: "",
        loginStatus: "unknown",
        createdAt: Date.now()
      });
      saveAccountsToDisk();
      return accounts;
    }
  );
  import_electron.ipcMain.handle("remove-account", (_e, accountId) => {
    accounts = accounts.filter((a) => a.id !== accountId);
    saveAccountsToDisk();
    return accounts;
  });
  import_electron.ipcMain.handle("check-all-accounts", async () => {
    for (const acct of accounts) {
      acct.loginStatus = await detectAccountLoginStatus(acct);
    }
    saveAccountsToDisk();
    return accounts;
  });
  import_electron.ipcMain.handle("open-account-login", (_e, accountId) => {
    const acct = accounts.find((a) => a.id === accountId);
    if (!acct) return false;
    const win = new import_electron.BrowserWindow({
      width: 960,
      height: 640,
      webPreferences: { partition: acct.partition }
    });
    win.loadURL(platformLoginUrl(acct.platformId));
    win.webContents.on("did-finish-load", async () => {
      acct.loginStatus = await detectAccountLoginStatus(acct);
      saveAccountsToDisk();
      mainWindow?.webContents.send("accounts-updated", accounts);
    });
    return true;
  });
  import_electron.ipcMain.handle(
    "publish-batch",
    async (_e, input) => {
      const results = [];
      for (const accountId of input.accountIds) {
        const acct = accounts.find((a) => a.id === accountId);
        if (!acct) {
          results.push({ accountId, ok: false, message: "\u8D26\u53F7\u4E0D\u5B58\u5728" });
          continue;
        }
        try {
          const win = new import_electron.BrowserWindow({
            show: false,
            webPreferences: { partition: acct.partition }
          });
          await win.loadURL(platformPublishUrl(acct.platformId));
          await win.webContents.executeJavaScript(`
            (function(){
              const ta = document.querySelector('textarea, [contenteditable=true]');
              if (ta) {
                if (ta.tagName === 'TEXTAREA') ta.value = ${JSON.stringify(input.content)};
                else ta.innerText = ${JSON.stringify(input.content)};
                ta.dispatchEvent(new Event('input', { bubbles: true }));
              }
              return Boolean(ta);
            })();
          `);
          results.push({
            accountId,
            ok: true,
            message: acct.platformId === "wechat_mp" ? "\u516C\u4F17\u53F7\u4E3A\u534A\u81EA\u52A8\uFF1A\u5DF2\u586B\u5165\u8349\u7A3F\uFF0C\u8BF7\u5728\u9875\u9762\u786E\u8BA4\u53D1\u5E03" : "\u5DF2\u5C1D\u8BD5\u586B\u5165\u5185\u5BB9\uFF0C\u8BF7\u786E\u8BA4\u5E73\u53F0\u9875\u9762\u72B6\u6001"
          });
          win.close();
        } catch (e) {
          results.push({
            accountId,
            ok: false,
            message: e instanceof Error ? e.message : String(e)
          });
        }
      }
      return results;
    }
  );
});
import_electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") import_electron.app.quit();
});
