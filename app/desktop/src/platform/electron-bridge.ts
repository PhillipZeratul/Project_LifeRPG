import type { IPlatformBridge } from "@liferpg/sdk";

export class ElectronPlatformBridge implements IPlatformBridge {
    async openView(viewName: string): Promise<void> {
        //await window.electron.invoke("open_view", { viewName });
    }

    emit(event: string, payload?: unknown): void {
        //window.electron.emit(event, payload);
    }

    listen<T>(event: string, callback: (payload: T) => void): () => void {
        //const unlisten = window.electron.listen(event, (payload: T) => {
        //    callback(payload);
        //});
        //return unlisten;
        return () => {};
    }
}

export const platform: IPlatformBridge = new ElectronPlatformBridge();