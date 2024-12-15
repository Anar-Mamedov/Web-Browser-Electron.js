// main.js
const { app, BrowserWindow, BrowserView, ipcMain, Menu } = require("electron");
const path = require("path");

let win;
let tabs = [];
let selectedTabIndex = 0;

const PANEL_HEIGHT = 30; // Navigation bar yüksekliği
const TAB_BAR_HEIGHT = 30; // Tab bar yüksekliği
const TOTAL_BAR_HEIGHT = PANEL_HEIGHT + TAB_BAR_HEIGHT; // Toplam üst bar yüksekliği

let barsHidden = false; // Bars are initially visible

function createWindow() {
  Menu.setApplicationMenu(null);

  win = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false,
      enableRemoteModule: false,
      allowRunningInsecureContent: true,
    },
  });

  // Üstte tab bar ve altında navigation bar olan HTML sayfasını yükle
  win.loadFile(path.join(__dirname, "../renderer/index.html"));

  // İlk sekme pbtpro.com ile açılsın
  createTab("https://pbtpro.com");

  win.on("resize", () => {
    updateViewBounds();
  });

  // IPC event'lar
  ipcMain.on("navigate-back", () => {
    const view = getSelectedTabView();
    if (view && view.webContents.canGoBack()) view.webContents.goBack();
  });

  ipcMain.on("navigate-forward", () => {
    const view = getSelectedTabView();
    if (view && view.webContents.canGoForward()) view.webContents.goForward();
  });

  ipcMain.on("reload-page", () => {
    const view = getSelectedTabView();
    if (view) view.webContents.reload();
  });

  ipcMain.on("navigate-to-url", (event, url) => {
    const view = getSelectedTabView();
    if (!view) return;
    let finalURL = url;
    try {
      new URL(url);
    } catch {
      finalURL = "https://" + url;
    }
    view.webContents.loadURL(finalURL);
  });

  ipcMain.on("create-tab", () => {
    // Yeni sekmeler boş açılsın (about:blank)
    createTab("about:blank");
  });

  ipcMain.on("switch-tab", (event, index) => {
    switchTab(index);
  });

  ipcMain.on("close-tab", (event, index) => {
    closeTab(index);
  });
}

// Yeni sekme oluşturma fonksiyonu
function createTab(initialURL) {
  const view = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, "../renderer/renderer.js"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false,
      enableRemoteModule: false,
      allowRunningInsecureContent: true,
    },
  });

  view.webContents.loadURL(initialURL);

  // Navigasyon event'ları
  view.webContents.on("did-navigate", (event, newURL) => {
    if (isTabSelected(view)) {
      win.webContents.send("update-url", newURL);
      updateTabsInRenderer(); // URL değişince tab başlığını da güncelle
    }
  });

  view.webContents.on("did-navigate-in-page", (event, newURL) => {
    if (isTabSelected(view)) {
      win.webContents.send("update-url", newURL);
      updateTabsInRenderer(); // URL değişince tab başlığını da güncelle
    }
  });

  // Sayfa başlığı güncellendiğinde tab başlığını da güncelle
  view.webContents.on("page-title-updated", (event, title) => {
    if (isTabSelected(view)) {
      updateTabsInRenderer();
    }
  });

  // Full-screen event'ları
  view.webContents.on("enter-html-full-screen", () => {
    barsHidden = true;
    updateViewBounds();
    win.webContents.send("hide-bars");
    console.log("Entered full-screen mode.");
  });

  view.webContents.on("leave-html-full-screen", () => {
    barsHidden = false;
    updateViewBounds();
    win.webContents.send("show-bars");
    console.log("Left full-screen mode.");
  });

  tabs.push({ view });
  switchTab(tabs.length - 1);
}

// Aktif sekmenin view'ını getir
function getSelectedTabView() {
  if (tabs[selectedTabIndex]) {
    return tabs[selectedTabIndex].view;
  }
  return null;
}

// Belirli bir view'ın seçili sekme olup olmadığını kontrol et
function isTabSelected(view) {
  return tabs[selectedTabIndex] && tabs[selectedTabIndex].view === view;
}

// Sekme değiştir
function switchTab(index) {
  if (index < 0 || index >= tabs.length) return;

  const oldView = getSelectedTabView();
  if (oldView) {
    win.removeBrowserView(oldView);
  }

  selectedTabIndex = index;
  const newView = getSelectedTabView();
  if (newView) {
    win.addBrowserView(newView);
    updateViewBounds();
    const currentURL = newView.webContents.getURL();
    win.webContents.send("update-url", currentURL);
  }

  updateTabsInRenderer();
}

// Sekmeyi kapat
function closeTab(index) {
  if (index < 0 || index >= tabs.length) return;

  const closingTabSelected = index === selectedTabIndex;
  const oldView = tabs[index].view;

  // Sekmeyi diziden çıkar
  tabs.splice(index, 1);

  if (oldView) {
    // Event listener'ları kaldır
    oldView.webContents.removeAllListeners("did-navigate");
    oldView.webContents.removeAllListeners("did-navigate-in-page");
    oldView.webContents.removeAllListeners("page-title-updated");
    oldView.webContents.removeAllListeners("enter-html-full-screen");
    oldView.webContents.removeAllListeners("leave-html-full-screen");

    // BrowserView'i pencereden kaldır
    win.removeBrowserView(oldView);

    // webContents'i durdur
    oldView.webContents.stop();

    // Kaynakları serbest bırak
    oldView.webContents.destroy();
  }

  // Eğer kapatılan sekme seçiliyse, başka bir sekmeye geç
  if (closingTabSelected) {
    if (tabs.length > 0) {
      let newIndex = index;
      if (newIndex >= tabs.length) {
        newIndex = tabs.length - 1;
      }
      switchTab(newIndex);
    } else {
      // Hiç sekme kalmadıysa yeni boş sekme aç
      createTab("about:blank");
    }
  } else {
    // Kapatılan sekme seçili sekme değilse sadece sekmeleri güncelle
    if (tabs[selectedTabIndex]) {
      const currentURL = tabs[selectedTabIndex].view.webContents.getURL();
      win.webContents.send("update-url", currentURL);
    }
    updateTabsInRenderer();
  }
}

// Sekmelerin listesini renderer'a gönder
function updateTabsInRenderer() {
  const tabUrls = tabs.map((t, i) => {
    const title = t.view.webContents.getTitle() || "New Tab";
    return { title, index: i };
  });
  win.webContents.send("update-tabs", {
    tabs: tabUrls,
    selectedIndex: selectedTabIndex,
  });
}

// Pencere boyutu değiştiğinde veya sekme değiştiğinde view boyutlarını güncelle
function updateViewBounds() {
  if (!win) return;
  let [winWidth, winHeight] = win.getContentSize();
  const view = getSelectedTabView();
  if (view) {
    if (barsHidden) {
      view.setBounds({
        x: 0,
        y: 0,
        width: winWidth,
        height: winHeight,
      });
    } else {
      view.setBounds({
        x: 0,
        y: TOTAL_BAR_HEIGHT,
        width: winWidth,
        height: winHeight - TOTAL_BAR_HEIGHT,
      });
    }
    view.setAutoResize({ width: true, height: true });
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
