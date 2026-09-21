import type { IPluginContext } from "./types";

export abstract class BasePlugin {
    protected context: IPluginContext;

    constructor(context: IPluginContext) {
        this.context = context;
    }

    abstract onLoad(): Promise<void> | void;
    abstract onUnload(): Promise<void> | void;
}