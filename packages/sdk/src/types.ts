export interface IPluginContext {
    manifest: IPluginManifest;
    events: IEventBus;
    services: IServiceRegistry;
}

export interface IPluginManifest {
    id: string;
    name: string;
    version: string;
    author: string;
    description: string;
    dependencies?: string[];
}

export interface IEventBus {
    on<T = unknown>(event: string, callback: EventCallback<T>): () => void;
    off<T = unknown>(event: string, callback: EventCallback<T>): void;
    emit<T = unknown>(event: string, payload: T): void;
}

export type EventCallback<T = unknown> = (payload: T) => Promise<void> | void;

export interface IServiceRegistry {
    register<T>(id: string, implementation: T): void;
    unregister(id: string): void;
    get<T>(id: string): T | undefined;
    has(id: string): boolean;
}