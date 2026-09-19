export type EventCallback<T = unknown> = (payload: T) => Promise<void> | void;

export interface IEventBus {
    on<T = unknown>(event: string, callback: EventCallback<T>): () => void;
    off<T = unknown>(event: string, callback: EventCallback<T>): void;
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

export interface IServiceRegistry {
    register<T>(id: string, implementation: T): void;
    unregister(id: string): void;
    get<T>(id: string): T | undefined;
    has(id: string): boolean;
}

export interface PluginContext {
    manifest: PluginManifest;
    events: IEventBus;
    services: IServiceRegistry;
}