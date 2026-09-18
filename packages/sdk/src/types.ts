export type EventCallback<T = unknown> = (payload: T) => Promise<void> | void;

export interface IEventBus {
    on<T = unknown>(event: string, callback: EventCallback<T>): () => void;
    off(event: string, callback: EventCallback): void;
    emit<T = unknown>(event: string, payload: T): void;
}

export interface PluginManifest {
    id: string;
    name: string;
    version: string;
    author: string;
    description: string;
    dependencies?: string[];
}

export interface PluginContext {
    manifest: PluginManifest;
    events: IEventBus;
    services: IServiceRegistry;
}

export abstract class BasePlugin {
    protected context: PluginContext;

    constructor(context: PluginContext) {
        this.context = context;
    }

    abstract onload(): Promise<void> | void;
    abstract onunload(): Promise<void> | void;
}