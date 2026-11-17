import { BasePlugin } from "./base-plugin";
import type { IPluginManifest } from "./manifest";

export * from "./manifest";

declare const __brand: unique symbol;

export interface IPluginContext {
    manifest: IPluginManifest;
    events: IEventBus;
    registerRpcHandler?<TParams = unknown, TResult = unknown>(
        method: string,
        handler: (params: TParams, context?: unknown) => Promise<TResult> | TResult,
        options?: unknown
    ): void;
}

export interface IPluginConstructor<T extends BasePlugin = BasePlugin> {
    new (context: IPluginContext): T;
    readonly manifest: IPluginManifest;
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