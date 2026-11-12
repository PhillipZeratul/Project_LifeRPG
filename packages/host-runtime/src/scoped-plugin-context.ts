import type { IPluginContext, IPluginManifest, IEventBus, IEventDefinition, EventCallback} from "@liferpg/sdk";

export class ScopedPluginContext implements IPluginContext {
    public readonly manifest: IPluginManifest;
    public readonly events: IEventBus;
    private unlisteners: Array<() => void> = [];

    constructor(manifest: IPluginManifest, globalBus: IEventBus) {
        this.manifest = manifest;

        this.events = {
            on: <T>(event: IEventDefinition<T>, callback: EventCallback<T>) => {
                const unlisten = globalBus.on(event, callback);
                this.unlisteners.push(unlisten);
                return unlisten;
            },
            off: (event, callback) => globalBus.off(event, callback),
            emit: (event, payload) => globalBus.emit(event, payload),
        };
    }

    public dispose() {
        for (const unlisten of this.unlisteners) {
            unlisten();
        }
        this.unlisteners = [];
    }
}