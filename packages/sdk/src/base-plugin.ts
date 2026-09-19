import type { PluginContext } from "./types";

export abstract class BasePlugin {
    protected context: PluginContext;

    constructor(context: PluginContext) {
        this.context = context;
    }

    abstract onload(): Promise<void> | void;
    abstract onunload(): Promise<void> | void;
}