import { BaseEventBus, BasePlugin, IServiceRegistry, IPluginContext, IPluginManifest } from '@liferpg/sdk';

export class PluginManager {
    private plugins = new Map<string, BasePlugin>();

    constructor(
        private eventBus: BaseEventBus,
        private serviceRegistry: IServiceRegistry
    ) {}

    async loadPlugin(PluginClass: new (ctx: IPluginContext) => BasePlugin, manifest: IPluginManifest) {
        if (manifest.dependencies) {
            for (const dep of manifest.dependencies) {
                if (!this.serviceRegistry.has(dep)) {
                    throw new Error(`Plugin ${manifest.id} depends on missing service: ${dep}`);
                }
            }
        }

        const context: IPluginContext = {
            manifest,
            events: this.eventBus,
            services: this.serviceRegistry,
        };

        const instance = new PluginClass(context);
        await instance.onload();
        this.plugins.set(manifest.id, instance);
        console.log(`[Host] Loaded plugin ${manifest.name} (v${manifest.version})`);
    }

    async unLoadPlugin(id: string) {
        const instance = this.plugins.get(id);
        if (instance) {
            await instance.onload();
            this.plugins.delete(id);
            console.log(`[Host] Unloaded plugin ${id}`);
        }
    }
}