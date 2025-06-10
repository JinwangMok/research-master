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
const { autoUpdater } = require("electron-updater");

let mainWindow;
let mcpServerProcess;

// Enable live reload for Electron in development
if (isDev) {
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
        titleBarStyle: "hiddenInset",
        backgroundColor: "#121212",
        show: false,
    });

    // Load the app
    mainWindow.loadURL(
        isDev
            ? "http://localhost:3001"
            : `file://${path.join(__dirname, "../build/index.html")}`
    );

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

    // Check for updates
    if (!isDev) {
        autoUpdater.checkForUpdatesAndNotify();
    }
}

function createMenu() {
    const template = [
        {
            label: "File",
            submenu: [
                {
                    label: "New Research",
                    accelerator: "CmdOrCtrl+N",
                    click: () => {
                        mainWindow.webContents.send("menu:new-research");
                    },
                },
                {
                    label: "Open Workspace",
                    accelerator: "CmdOrCtrl+O",
                    click: async () => {
                        const result = await dialog.showOpenDialog(mainWindow, {
                            properties: ["openDirectory"],
                        });

                        if (!result.canceled) {
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
                                mainWindow.webContents.send(
                                    "menu:export",
                                    "pdf"
                                ),
                        },
                        {
                            label: "As LaTeX",
                            click: () =>
                                mainWindow.webContents.send(
                                    "menu:export",
                                    "latex"
                                ),
                        },
                        {
                            label: "As PowerPoint",
                            click: () =>
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
                { label: "Undo", accelerator: "CmdOrCtrl+Z", role: "undo" },
                {
                    label: "Redo",
                    accelerator: "Shift+CmdOrCtrl+Z",
                    role: "redo",
                },
                { type: "separator" },
                { label: "Cut", accelerator: "CmdOrCtrl+X", role: "cut" },
                { label: "Copy", accelerator: "CmdOrCtrl+C", role: "copy" },
                { label: "Paste", accelerator: "CmdOrCtrl+V", role: "paste" },
            ],
        },
        {
            label: "View",
            submenu: [
                { label: "Reload", accelerator: "CmdOrCtrl+R", role: "reload" },
                {
                    label: "Toggle Developer Tools",
                    accelerator:
                        process.platform === "darwin"
                            ? "Alt+Command+I"
                            : "Ctrl+Shift+I",
                    click: () => {
                        mainWindow.webContents.toggleDevTools();
                    },
                },
                { type: "separator" },
                {
                    label: "Actual Size",
                    accelerator: "CmdOrCtrl+0",
                    role: "resetZoom",
                },
                {
                    label: "Zoom In",
                    accelerator: "CmdOrCtrl+Plus",
                    role: "zoomIn",
                },
                {
                    label: "Zoom Out",
                    accelerator: "CmdOrCtrl+-",
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
                    accelerator: "CmdOrCtrl+R",
                    click: () =>
                        mainWindow.webContents.send("menu:start-research"),
                },
                {
                    label: "View Progress",
                    accelerator: "CmdOrCtrl+P",
                    click: () =>
                        mainWindow.webContents.send("menu:view-progress"),
                },
                { type: "separator" },
                {
                    label: "Run Tests",
                    accelerator: "CmdOrCtrl+T",
                    click: () => mainWindow.webContents.send("menu:run-tests"),
                },
                {
                    label: "Generate Documentation",
                    accelerator: "CmdOrCtrl+D",
                    click: () =>
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
                                : "Please start Docker to use the application",
                        });
                    },
                },
                {
                    label: "Service Health",
                    click: () =>
                        mainWindow.webContents.send("menu:check-health"),
                },
                { type: "separator" },
                {
                    label: "Settings",
                    accelerator: "CmdOrCtrl+,",
                    click: () => mainWindow.webContents.send("menu:settings"),
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
        exec("docker info", (error) => {
            resolve(!error);
        });
    });
}

// Start MCP server locally if in development
async function startLocalMCPServer() {
    if (!isDev) return;

    const { spawn } = require("child_process");

    console.log("Starting local MCP server...");

    mcpServerProcess = spawn("npm", ["run", "start:mcp"], {
        cwd: path.join(__dirname, "../../mcp-server"),
        shell: true,
    });

    mcpServerProcess.stdout.on("data", (data) => {
        console.log(`MCP Server: ${data}`);
    });

    mcpServerProcess.stderr.on("data", (data) => {
        console.error(`MCP Server Error: ${data}`);
    });

    mcpServerProcess.on("close", (code) => {
        console.log(`MCP Server exited with code ${code}`);
    });

    // Give the server time to start
    await new Promise((resolve) => setTimeout(resolve, 5000));
}

// IPC Handlers
ipcMain.handle("get-app-version", () => {
    return app.getVersion();
});

ipcMain.handle("check-docker-status", async () => {
    return await checkDockerStatus();
});

ipcMain.handle("select-directory", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory"],
    });

    return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("save-file", async (event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result.canceled ? null : result.filePath;
});

// App event handlers
app.whenReady().then(async () => {
    // Start local MCP server in development
    if (isDev) {
        await startLocalMCPServer();
    }

    createWindow();
});

app.on("window-all-closed", () => {
    // Kill MCP server process if running
    if (mcpServerProcess) {
        mcpServerProcess.kill();
    }

    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// Handle app updates
autoUpdater.on("update-available", () => {
    dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Update Available",
        message:
            "A new version is available. It will be downloaded in the background.",
        buttons: ["OK"],
    });
});

autoUpdater.on("update-downloaded", () => {
    dialog
        .showMessageBox(mainWindow, {
            type: "info",
            title: "Update Ready",
            message:
                "Update downloaded. The application will restart to apply the update.",
            buttons: ["Restart Now", "Later"],
        })
        .then((result) => {
            if (result.response === 0) {
                autoUpdater.quitAndInstall();
            }
        });
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
