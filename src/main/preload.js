// preload.js

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  navigateBack: () => ipcRenderer.send("navigate-back"),
  navigateForward: () => ipcRenderer.send("navigate-forward"),
  reloadPage: () => ipcRenderer.send("reload-page"),
  navigateToURL: (url) => ipcRenderer.send("navigate-to-url", url),
  createTab: () => ipcRenderer.send("create-tab"),
  switchTab: (index) => ipcRenderer.send("switch-tab", index),
  closeTab: (index) => ipcRenderer.send("close-tab", index),
  onUpdateURL: (callback) =>
    ipcRenderer.on("update-url", (event, url) => callback(url)),
  onUpdateTabs: (callback) =>
    ipcRenderer.on("update-tabs", (event, data) => callback(data)),
  onHideBars: (callback) => ipcRenderer.on("hide-bars", () => callback()),
  onShowBars: (callback) => ipcRenderer.on("show-bars", () => callback()),
});
