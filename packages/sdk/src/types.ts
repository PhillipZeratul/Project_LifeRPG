import { BasePlugin } from "./base-plugin";

declare const __brand: unique symbol;

export interface IPluginContext {
    manifest: IPluginManifest;
    events: IEventBus;
}

export interface IPluginManifest {
    name: string;
    version: string;
    displayName: string;
    author: string;
    description: string;
    dependencies?: Record<string, string>;
    permissions?: string[];
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