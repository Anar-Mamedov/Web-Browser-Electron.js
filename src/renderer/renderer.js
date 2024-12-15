// renderer.js

const { ipcRenderer } = require("electron");

ipcRenderer.on("update_available", () => {
  alert(
    "Yeni bir güncelleme mevcut! Güncellemeyi indirmek için uygulamayı yeniden başlatın."
  );
});

ipcRenderer.on("update_downloaded", () => {
  const response = confirm(
    "Güncelleme indirildi. Uygulamayı yeniden başlatmak ister misiniz?"
  );
  if (response) {
    ipcRenderer.send("restart_app");
  }
});
