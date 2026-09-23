declare const __brand: unique symbol;

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
    dependencies?: IServiceToken<unknown>[];
}

export interface IEventBus {
    on<T>(event: IEventDefinition<T>, callback: EventCallback<T>): () => void;
    off<T>(event: IEventDefinition<T>, callback: EventCallback<T>): void;
    emit<T>(event: IEventDefinition<T>, payload: T): void;
}

export type EventCallback<T> = (payload: T) => Promise<void> | void;

export type IEventDefinition<T> = string &{
    readonly [__brand]: T;
};

export function defineEvent<T = void>(name: string): IEventDefinition<T> {
    return name as IEventDefinition<T>;
}

export interface IServiceRegistry {
    register<T>(token: IServiceToken<T>, implementation: T): void;
    unregister(token: IServiceToken<unknown>): void;
    get<T>(token: IServiceToken<T>): T | undefined;
    has(token: IServiceToken<unknown>): boolean;
}

export type IServiceToken<T> = string & {
    readonly [__brand]: T;
}

export function createServiceToken<T>(id: string): IServiceToken<T> {
    return id as IServiceToken<T>;
}