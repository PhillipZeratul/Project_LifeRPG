import type { IPluginContext } from "./types";

export abstract class BasePlugin {
    protected context: IPluginContext;

    constructor(context: IPluginContext) {
        this.context = context;
    }

    abstract onload(): Promise<void> | void;
    abstract onunload(): Promise<void> | void;
}