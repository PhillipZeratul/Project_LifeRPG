import type { IPlatformBridge } from "@liferpg/sdk";
export declare class ElectronPlatformBridge implements IPlatformBridge {
    openView(viewName: string): Promise<void>;
    emit(event: string, payload?: unknown): void;
    listen<T>(event: string, callback: (payload: T) => void): () => void;
}
//# sourceMappingURL=electron-bridge.d.ts.map