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

export interface IEventDefinition<T> {
    readonly id: symbol;
    readonly name: string;
    readonly _payloadType?: T;
}

export function defineEvent<T = void>(name: string): IEventDefinition<T> {
    return {
        id: Symbol(name),
        name,
    };
}

export interface IServiceRegistry {
    register<T>(token: IServiceToken<T>, implementation: T): void;
    unregister(token: IServiceToken<unknown>): void;
    get<T>(token: IServiceToken<T>): T | undefined;
    has(token: IServiceToken<unknown>): boolean;
}

export interface IServiceToken<T> {
    readonly id: symbol;
    readonly description: string;
    readonly _serviceType? : T;
}

export function createServiceToken<T>(description: string): IServiceToken<T> {
    return {
        id: Symbol(description),
        description,
    };
}