import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
    openView: (viewName: string) => ipcRenderer.invoke("open_view", { viewName }),
    emit: (event: string, payload?: unknown) => ipcRenderer.send("app:emit", { event, payload }),
    listen: (event: string, callback: (payload: unknown) => void) => {
        const channel = `event:${event}`;
        const listener = (_e: Electron.IpcRendererEvent, payload: unknown) => callback(payload);
        ipcRenderer.on(channel, listener);
        return () => ipcRenderer.removeListener(channel, listener);
    },
});
