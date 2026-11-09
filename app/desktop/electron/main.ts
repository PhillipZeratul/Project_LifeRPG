import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, "..");
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;

const windows = new Map<string, BrowserWindow>();

function parseTargetView(args: string[]): string {
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--view" && args[i + 1]) {
            return args[i + 1] as string;
        }
    }
    return "master-hub";
}

function openOrFocusView(viewName: string): BrowserWindow {
    const existing = windows.get(viewName);
    if (existing && !existing.isDestroyed()) {
        if (existing.isMinimized()) existing.restore();
        existing.show();
        existing.focus();
        return existing;
    }

    const isTracker = viewName === "routine-time-tracker";
    const win = new BrowserWindow({
        title: isTracker ? "Routine Time Tracker" : "LifeRPG Hub",
        width: isTracker ? 400 : 800,
        height: 600,
        alwaysOnTop: isTracker,
        resizable: !isTracker,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.mjs"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    windows.set(viewName, win);

    win.on("closed", () => {
        windows.delete(viewName);
    });

    const route = `/${viewName}`;
    if (process.env.VITE_DEV_SERVER_URL) {
        void win.loadURL(`${process.env.VITE_DEV_SERVER_URL}#${route}`);
    } else {
        void win.loadFile(path.join(RENDERER_DIST, "index.html"), { hash: route });
    }

    return win;
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on("second-instance", (_event, argv) => {
        const targetView = parseTargetView(argv);
        openOrFocusView(targetView);
    });

    void app.whenReady().then(() => {
        ipcMain.handle("open_view", (_event, { viewName }: { viewName: string }) => {
            openOrFocusView(viewName);
        });

        ipcMain.on("app:emit", (_event, { event, payload }: { event: string; payload: unknown }) => {
            for (const win of windows.values()) {
                if (!win.isDestroyed()) {
                    win.webContents.send(`event:${event}`, payload);
                }
            }
        });

        const targetView = parseTargetView(process.argv);
        openOrFocusView(targetView);
    });
}

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
