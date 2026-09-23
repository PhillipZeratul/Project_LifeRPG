import type { IPluginContext, IPluginManifest } from "./types";

export abstract class BasePlugin {
    protected context: IPluginContext;

    constructor(context: IPluginContext) {
        this.context = context;
    }

    public get manifest(): IPluginManifest {
        return this.context.manifest;
    }

    abstract onLoad(): Promise<void> | void;
    abstract onUnload(): Promise<void> | void;
}