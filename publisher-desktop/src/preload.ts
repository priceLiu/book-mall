import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("publisherDesktop", {
  getAuth: () => ipcRenderer.invoke("get-auth"),
  openLogin: () => ipcRenderer.invoke("open-login"),
  logout: () => ipcRenderer.invoke("logout"),
  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),
  listAccounts: () => ipcRenderer.invoke("list-accounts"),
  addAccount: (platformId: string, label: string) =>
    ipcRenderer.invoke("add-account", { platformId, label }),
  removeAccount: (accountId: string) => ipcRenderer.invoke("remove-account", accountId),
  checkAllAccounts: () => ipcRenderer.invoke("check-all-accounts"),
  openAccountLogin: (accountId: string) => ipcRenderer.invoke("open-account-login", accountId),
  publishBatch: (accountIds: string[], content: string, title?: string) =>
    ipcRenderer.invoke("publish-batch", { accountIds, content, title }),
  onAuthUpdated: (callback: (auth: unknown) => void) => {
    ipcRenderer.on("auth-updated", (_e, auth) => callback(auth));
  },
  onAccountsUpdated: (callback: (accounts: unknown) => void) => {
    ipcRenderer.on("accounts-updated", (_e, list) => callback(list));
  },
});
