// desktop-app/electron/main.js
const {
    app,
    BrowserWindow,
    Menu,
    shell,
    dialog,
    ipcMain,
} = require("electron");
const path = require("path");
const isDev = require("electron-is-dev");

let mainWindow;
let mcpServerProcess;

// Enable live reload for Electron in development
if (isDev) {
    try {
        require("electron-reload")(__dirname, {
            electron: path.join(
                __dirname,
                "..",
                "node_modules",
                ".bin",
                "electron"
            ),
            hardResetMethod: "exit",
        });
    } catch (err) {
        console.log("Error loading electron-reload:", err);
    }
}

function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js"),
        },
        icon: path.join(__dirname, "../assets/icon.png"),
        titleBarStyle:
            process.platform === "darwin" ? "hiddenInset" : "default",
        backgroundColor: "#121212",
        show: false,
    });

    // Load the app - IMPORTANT: Use port 3001 for React dev server
    const startUrl = isDev
        ? "http://localhost:3001"
        : `file://${path.join(__dirname, "../build/index.html")}`;

    mainWindow.loadURL(startUrl);

    // Show window when ready
    mainWindow.once("ready-to-show", () => {
        mainWindow.show();

        // Open DevTools in development
        if (isDev) {
            mainWindow.webContents.openDevTools();
        }
    });

    // Handle window closed
    mainWindow.on("closed", () => {
        mainWindow = null;
    });

    // Create application menu
    createMenu();
}

function createMenu() {
    const template = [
        {
            label: "File",
            submenu: [
                {
                    label: "New Research",
                    accelerator:
                        process.platform === "darwin" ? "Cmd+N" : "Ctrl+N",
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.send("menu:new-research");
                        }
                    },
                },
                {
                    label: "Open Workspace",
                    accelerator:
                        process.platform === "darwin" ? "Cmd+O" : "Ctrl+O",
                    click: async () => {
                        const result = await dialog.showOpenDialog(mainWindow, {
                            properties: ["openDirectory"],
                        });

                        if (!result.canceled && mainWindow) {
                            mainWindow.webContents.send(
                                "menu:open-workspace",
                                result.filePaths[0]
                            );
                        }
                    },
                },
                { type: "separator" },
                {
                    label: "Export Results",
                    submenu: [
                        {
                            label: "As PDF",
                            click: () =>
                                mainWindow &&
                                mainWindow.webContents.send(
                                    "menu:export",
                                    "pdf"
                                ),
                        },
                        {
                            label: "As LaTeX",
                            click: () =>
                                mainWindow &&
                                mainWindow.webContents.send(
                                    "menu:export",
                                    "latex"
                                ),
                        },
                        {
                            label: "As PowerPoint",
                            click: () =>
                                mainWindow &&
                                mainWindow.webContents.send(
                                    "menu:export",
                                    "pptx"
                                ),
                        },
                    ],
                },
                { type: "separator" },
                {
                    label: "Quit",
                    accelerator:
                        process.platform === "darwin" ? "Cmd+Q" : "Ctrl+Q",
                    click: () => {
                        app.quit();
                    },
                },
            ],
        },
        {
            label: "Edit",
            submenu: [
                {
                    label: "Undo",
                    accelerator:
                        process.platform === "darwin" ? "Cmd+Z" : "Ctrl+Z",
                    role: "undo",
                },
                {
                    label: "Redo",
                    accelerator:
                        process.platform === "darwin"
                            ? "Shift+Cmd+Z"
                            : "Ctrl+Y",
                    role: "redo",
                },
                { type: "separator" },
                {
                    label: "Cut",
                    accelerator:
                        process.platform === "darwin" ? "Cmd+X" : "Ctrl+X",
                    role: "cut",
                },
                {
                    label: "Copy",
                    accelerator:
                        process.platform === "darwin" ? "Cmd+C" : "Ctrl+C",
                    role: "copy",
                },
                {
                    label: "Paste",
                    accelerator:
                        process.platform === "darwin" ? "Cmd+V" : "Ctrl+V",
                    role: "paste",
                },
            ],
        },
        {
            label: "View",
            submenu: [
                {
                    label: "Reload",
                    accelerator:
                        process.platform === "darwin" ? "Cmd+R" : "Ctrl+R",
                    role: "reload",
                },
                {
                    label: "Toggle Developer Tools",
                    accelerator:
                        process.platform === "darwin"
                            ? "Alt+Command+I"
                            : "Ctrl+Shift+I",
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.toggleDevTools();
                        }
                    },
                },
                { type: "separator" },
                {
                    label: "Actual Size",
                    accelerator:
                        process.platform === "darwin" ? "Cmd+0" : "Ctrl+0",
                    role: "resetZoom",
                },
                {
                    label: "Zoom In",
                    accelerator:
                        process.platform === "darwin"
                            ? "Cmd+Plus"
                            : "Ctrl+Plus",
                    role: "zoomIn",
                },
                {
                    label: "Zoom Out",
                    accelerator:
                        process.platform === "darwin" ? "Cmd+-" : "Ctrl+-",
                    role: "zoomOut",
                },
                { type: "separator" },
                {
                    label: "Toggle Fullscreen",
                    accelerator: "F11",
                    role: "togglefullscreen",
                },
            ],
        },
        {
            label: "Research",
            submenu: [
                {
                    label: "Start Research",
                    accelerator:
                        process.platform === "darwin" ? "Cmd+R" : "Ctrl+R",
                    click: () =>
                        mainWindow &&
                        mainWindow.webContents.send("menu:start-research"),
                },
                {
                    label: "View Progress",
                    accelerator:
                        process.platform === "darwin" ? "Cmd+P" : "Ctrl+P",
                    click: () =>
                        mainWindow &&
                        mainWindow.webContents.send("menu:view-progress"),
                },
                { type: "separator" },
                {
                    label: "Run Tests",
                    accelerator:
                        process.platform === "darwin" ? "Cmd+T" : "Ctrl+T",
                    click: () =>
                        mainWindow &&
                        mainWindow.webContents.send("menu:run-tests"),
                },
                {
                    label: "Generate Documentation",
                    accelerator:
                        process.platform === "darwin" ? "Cmd+D" : "Ctrl+D",
                    click: () =>
                        mainWindow &&
                        mainWindow.webContents.send("menu:generate-docs"),
                },
            ],
        },
        {
            label: "Tools",
            submenu: [
                {
                    label: "Docker Status",
                    click: async () => {
                        const dockerStatus = await checkDockerStatus();
                        dialog.showMessageBox(mainWindow, {
                            type: "info",
                            title: "Docker Status",
                            message: dockerStatus
                                ? "Docker is running"
                                : "Docker is not running",
                            detail: dockerStatus
                                ? "All services are operational"
                                : "Please start Docker Desktop to use the application",
                        });
                    },
                },
                {
                    label: "Service Health",
                    click: () =>
                        mainWindow &&
                        mainWindow.webContents.send("menu:check-health"),
                },
                { type: "separator" },
                {
                    label: "Settings",
                    accelerator:
                        process.platform === "darwin" ? "Cmd+," : "Ctrl+,",
                    click: () =>
                        mainWindow &&
                        mainWindow.webContents.send("menu:settings"),
                },
            ],
        },
        {
            label: "Help",
            submenu: [
                {
                    label: "Documentation",
                    click: () => {
                        shell.openExternal("https://github.com/your-repo/docs");
                    },
                },
                {
                    label: "Report Issue",
                    click: () => {
                        shell.openExternal(
                            "https://github.com/your-repo/issues"
                        );
                    },
                },
                { type: "separator" },
                {
                    label: "About",
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: "info",
                            title: "About",
                            message: "Autonomous Research & Development System",
                            detail:
                                `Version: ${app.getVersion()}\n` +
                                "An AI-powered system for autonomous research, development, and documentation.\n\n" +
                                "Built with Electron, React, Docker, and Ollama.",
                        });
                    },
                },
            ],
        },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// Check Docker status
async function checkDockerStatus() {
    const { exec } = require("child_process");
    return new Promise((resolve) => {
        const command =
            process.platform === "win32" ? "docker info" : "docker info";
        exec(command, (error) => {
            resolve(!error);
        });
    });
}

// IPC Handlers
ipcMain.handle("get-app-version", () => {
    return app.getVersion();
});

ipcMain.handle("check-docker-status", async () => {
    return await checkDockerStatus();
});

ipcMain.handle("select-directory", async () => {
    if (!mainWindow) return null;

    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory"],
    });

    return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("save-file", async (event, options) => {
    if (!mainWindow) return null;

    const result = await dialog.showSaveDialog(mainWindow, options);
    return result.canceled ? null : result.filePath;
});

// App event handlers
app.whenReady().then(async () => {
    createWindow();
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on("second-instance", () => {
        // Someone tried to run a second instance, focus our window instead
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

// Security: Prevent new window creation
app.on("web-contents-created", (event, contents) => {
    contents.on("new-window", (event, navigationUrl) => {
        event.preventDefault();
        shell.openExternal(navigationUrl);
    });
});

// Export for testing
module.exports = { createWindow };
