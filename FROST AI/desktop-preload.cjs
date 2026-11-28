const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("frostDesktop", {
  isDesktop: true,
  googleSignIn: () => ipcRenderer.invoke("frostgpt:google-sign-in")
});
