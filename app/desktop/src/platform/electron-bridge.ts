import type { IPlatformBridge } from "@liferpg/sdk";

export class ElectronPlatformBridge implements IPlatformBridge {
    async openView(viewName: string): Promise<void> {
        await window.electron.openView(viewName);
    }

    emit(event: string, payload?: unknown): void {
        window.electron.emit(event, payload);
    }

    listen<T>(event: string, callback: (payload: T) => void): () => void {
        return window.electron.listen<T>(event, callback);
    }
}

export const platform: IPlatformBridge = new ElectronPlatformBridge();