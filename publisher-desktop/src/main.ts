import { app, BrowserWindow, ipcMain, session, shell, safeStorage } from "electron";
import * as http from "node:http";
import * as path from "node:path";
import * as fs from "node:fs";
import { buildClientLoginUrl } from "@private/publisher-client";
import { getPlatformMeta } from "@private/publisher-sync-core";

const PUBLISHER_WEB =
  process.env.PUBLISHER_WEB_ORIGIN?.trim() || "http://localhost:3011";
const BOOK_ORIGIN = process.env.BOOK_ORIGIN?.trim() || "http://localhost:3000";

type LoginStatus = "unknown" | "logged_in" | "needs_relogin";

type PlatformAccount = {
  id: string;
  platformId: string;
  label: string;
  partition: string;
  group: string;
  loginStatus: LoginStatus;
  createdAt: number;
};

type StoredAuth = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  deviceId: string;
  userId: string;
};

let mainWindow: BrowserWindow | null = null;
let accounts: PlatformAccount[] = [];

function authFilePath(): string {
  return path.join(app.getPath("userData"), "auth.bin");
}

function accountsFilePath(): string {
  return path.join(app.getPath("userData"), "accounts.json");
}

function loadAuth(): StoredAuth | null {
  try {
    const file = authFilePath();
    if (!fs.existsSync(file)) return null;
    const buf = fs.readFileSync(file);
    if (!safeStorage.isEncryptionAvailable()) {
      return JSON.parse(buf.toString("utf8")) as StoredAuth;
    }
    return JSON.parse(safeStorage.decryptString(buf)) as StoredAuth;
  } catch {
    return null;
  }
}

function saveAuth(auth: StoredAuth | null) {
  const file = authFilePath();
  if (!auth) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return;
  }
  const raw = JSON.stringify(auth);
  const buf = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(raw)
    : Buffer.from(raw, "utf8");
  fs.writeFileSync(file, buf);
}

function loadAccountsFromDisk(): PlatformAccount[] {
  try {
    const file = accountsFilePath();
    if (!fs.existsSync(file)) return [];
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as PlatformAccount[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAccountsToDisk() {
  fs.writeFileSync(accountsFilePath(), JSON.stringify(accounts, null, 2), "utf8");
}

function platformLoginUrl(platformId: string): string {
  const meta = getPlatformMeta(platformId);
  if (meta) {
    const loginUrls: Record<string, string> = {
      xiaohongshu: "https://creator.xiaohongshu.com/",
      douyin: "https://creator.douyin.com/",
      weibo: "https://weibo.com/",
      bilibili: "https://member.bilibili.com/",
      wechat_mp: "https://mp.weixin.qq.com/",
    };
    return loginUrls[platformId] ?? meta.publishUrl;
  }
  return "about:blank";
}

function platformPublishUrl(platformId: string): string {
  return getPlatformMeta(platformId)?.publishUrl ?? "about:blank";
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#0a0a0a",
    title: "一键发布",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
}

async function refreshAccessToken(refreshToken: string): Promise<StoredAuth | null> {
  const res = await fetch(`${BOOK_ORIGIN}/api/sso/client/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) return null;
  return {
    accessToken: String(data.access_token),
    refreshToken: String(data.refresh_token),
    expiresAt: Date.now() + Number(data.expires_in) * 1000,
    deviceId: String(data.device_id),
    userId: String(data.user_id),
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
      const auth: StoredAuth = {
        accessToken: access,
        refreshToken: refresh,
        expiresAt: Date.now() + expiresIn * 1000,
        deviceId,
        userId,
      };
      saveAuth(auth);
      mainWindow?.webContents.send("auth-updated", auth);
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<html><body><p>登录成功，可关闭此页返回桌面端。</p></body></html>");
    server.close();
  });

  server.listen(0, "127.0.0.1", () => {
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    const loopback = `http://127.0.0.1:${port}/callback`;
    const loginUrl = buildClientLoginUrl(PUBLISHER_WEB, "desktop", "/auth/client-callback", loopback);
    shell.openExternal(loginUrl);
  });
}

async function detectAccountLoginStatus(acct: PlatformAccount): Promise<LoginStatus> {
  try {
    const ses = session.fromPartition(acct.partition);
    const cookies = await ses.cookies.get({});
    if (cookies.length === 0) return "needs_relogin";
    return "logged_in";
  } catch {
    return "unknown";
  }
}

app.whenReady().then(() => {
  accounts = loadAccountsFromDisk();
  createMainWindow();

  ipcMain.handle("get-auth", async () => {
    let auth = loadAuth();
    if (auth && auth.expiresAt < Date.now() + 60_000) {
      auth = await refreshAccessToken(auth.refreshToken);
      saveAuth(auth);
      mainWindow?.webContents.send("auth-updated", auth);
    }
    return auth;
  });

  ipcMain.handle("open-login", () => {
    openSystemLogin();
  });

  ipcMain.handle("logout", () => {
    saveAuth(null);
    mainWindow?.webContents.send("auth-updated", null);
  });

  ipcMain.handle("open-external", (_e, url: string) => {
    if (typeof url === "string" && /^https?:\/\//.test(url)) {
      shell.openExternal(url);
    } else if (typeof url === "string" && url.startsWith("mailto:")) {
      shell.openExternal(url);
    }
  });

  ipcMain.handle("list-accounts", () => accounts);

  ipcMain.handle(
    "add-account",
    (_e, input: { platformId: string; label: string }) => {
      const id = `acct_${Date.now().toString(36)}`;
      const partition = `persist:acct-${id}`;
      accounts.push({
        id,
        platformId: input.platformId,
        label: input.label,
        partition,
        group: "",
        loginStatus: "unknown",
        createdAt: Date.now(),
      });
      saveAccountsToDisk();
      return accounts;
    },
  );

  ipcMain.handle("remove-account", (_e, accountId: string) => {
    accounts = accounts.filter((a) => a.id !== accountId);
    saveAccountsToDisk();
    return accounts;
  });

  ipcMain.handle("check-all-accounts", async () => {
    for (const acct of accounts) {
      acct.loginStatus = await detectAccountLoginStatus(acct);
    }
    saveAccountsToDisk();
    return accounts;
  });

  ipcMain.handle("open-account-login", (_e, accountId: string) => {
    const acct = accounts.find((a) => a.id === accountId);
    if (!acct) return false;
    const win = new BrowserWindow({
      width: 960,
      height: 640,
      webPreferences: { partition: acct.partition },
    });
    win.loadURL(platformLoginUrl(acct.platformId));
    win.webContents.on("did-finish-load", async () => {
      acct.loginStatus = await detectAccountLoginStatus(acct);
      saveAccountsToDisk();
      mainWindow?.webContents.send("accounts-updated", accounts);
    });
    return true;
  });

  ipcMain.handle(
    "publish-batch",
    async (_e, input: { accountIds: string[]; content: string; title?: string }) => {
      const results: Array<{ accountId: string; ok: boolean; message?: string }> = [];
      for (const accountId of input.accountIds) {
        const acct = accounts.find((a) => a.id === accountId);
        if (!acct) {
          results.push({ accountId, ok: false, message: "账号不存在" });
          continue;
        }
        try {
          const win = new BrowserWindow({
            show: false,
            webPreferences: { partition: acct.partition },
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
            message:
              acct.platformId === "wechat_mp"
                ? "公众号为半自动：已填入草稿，请在页面确认发布"
                : "已尝试填入内容，请确认平台页面状态",
          });
          win.close();
        } catch (e) {
          results.push({
            accountId,
            ok: false,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
      return results;
    },
  );
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
