"use strict";

// src/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("publisherDesktop", {
  getAuth: () => import_electron.ipcRenderer.invoke("get-auth"),
  openLogin: () => import_electron.ipcRenderer.invoke("open-login"),
  logout: () => import_electron.ipcRenderer.invoke("logout"),
  openExternal: (url) => import_electron.ipcRenderer.invoke("open-external", url),
  listAccounts: () => import_electron.ipcRenderer.invoke("list-accounts"),
  addAccount: (platformId, label) => import_electron.ipcRenderer.invoke("add-account", { platformId, label }),
  removeAccount: (accountId) => import_electron.ipcRenderer.invoke("remove-account", accountId),
  checkAllAccounts: () => import_electron.ipcRenderer.invoke("check-all-accounts"),
  openAccountLogin: (accountId) => import_electron.ipcRenderer.invoke("open-account-login", accountId),
  publishBatch: (accountIds, content, title) => import_electron.ipcRenderer.invoke("publish-batch", { accountIds, content, title }),
  onAuthUpdated: (callback) => {
    import_electron.ipcRenderer.on("auth-updated", (_e, auth) => callback(auth));
  },
  onAccountsUpdated: (callback) => {
    import_electron.ipcRenderer.on("accounts-updated", (_e, list) => callback(list));
  }
});
