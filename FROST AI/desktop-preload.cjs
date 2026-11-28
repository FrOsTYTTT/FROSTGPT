const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("frostDesktop", {
  googleSignIn: () => ipcRenderer.invoke("frostgpt:google-sign-in")
});
