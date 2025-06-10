// desktop-app/electron/preload.js
const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
    getVersion: () => ipcRenderer.invoke("get-app-version"),
    checkDocker: () => ipcRenderer.invoke("check-docker-status"),
    selectDirectory: () => ipcRenderer.invoke("select-directory"),
    saveFile: (options) => ipcRenderer.invoke("save-file", options),

    // Listen to menu events
    onMenuAction: (channel, func) => {
        const validChannels = [
            "menu:new-research",
            "menu:open-workspace",
            "menu:export",
            "menu:start-research",
            "menu:view-progress",
            "menu:run-tests",
            "menu:generate-docs",
            "menu:check-health",
            "menu:settings",
        ];

        if (validChannels.includes(channel)) {
            // Deliberately strip event as it includes `sender`
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
});
