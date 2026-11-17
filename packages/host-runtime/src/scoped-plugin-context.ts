import type {
    IPluginContext,
    IPluginManifest,
    IEventBus,
    IEventDefinition,
    EventCallback,
} from "@liferpg/sdk";
import type { HostRpcBridge, RpcHandler, RpcHandlerOptions } from "./rpc-bridge";

export class ScopedPluginContext implements IPluginContext {
    public readonly manifest: IPluginManifest;
    public readonly events: IEventBus;
    private cleanups: Array<() => void> = [];

    constructor(
        manifest: IPluginManifest,
        globalBus: IEventBus,
        private bridge?: HostRpcBridge
    ) {
        this.manifest = manifest;

        this.events = {
            on: <T>(event: IEventDefinition<T>, callback: EventCallback<T>) => {
                const unlisten = globalBus.on(event, callback);
                this.cleanups.push(unlisten);
                return unlisten;
            },
            off: (event, callback) => globalBus.off(event, callback),
            emit: (event, payload) => globalBus.emit(event, payload),
        };
    }

    public registerRpcHandler<TParams = unknown, TResult = unknown>(
        method: string,
        handler: RpcHandler<TParams, TResult>,
        options?: RpcHandlerOptions
    ): void {
        if (!this.bridge) {
            return;
        }

        const opts: RpcHandlerOptions = {
            ...options,
            pluginId: this.manifest.name,
        };

        this.bridge.registerHandler(method, handler, opts);
        this.cleanups.push(() => {
            this.bridge?.unregisterHandler(method);
        });
    }

    public addDisposable(disposable: () => void): void {
        this.cleanups.push(disposable);
    }

    public dispose(): void {
        for (const cleanup of this.cleanups) {
            try {
                cleanup();
            } catch (err) {
                console.error("[ScopedPluginContext] Error during cleanup:", err);
            }
        }
        this.cleanups = [];
    }
}
