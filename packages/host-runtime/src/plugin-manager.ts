import { BasePlugin, IPluginContext, IPluginManifest } from "@liferpg/sdk";
import { CentralEventBus } from "./central-event-bus";

export class PluginManager {
    private plugins = new Map<string, BasePlugin>();

    constructor(private eventBus: CentralEventBus) {}

    async loadPlugin(packageName: string) {
        if (this.plugins.has(packageName)) {
            console.log(`[Host] Plugin ${packageName} already loaded`);
            return;
        }

        const [manifestModule, coreModule] = await Promise.all([
            import(`${packageName}/package.json`, { with: { type: "json" } }),
            import(packageName),
        ]);

        const manifest = manifestModule.default as IPluginManifest;
        const PluginClass = coreModule.default;

        if (manifest.dependencies) {
            for (const requiredPkg of Object.keys(manifest.dependencies)) {
                if (!this.plugins.has(requiredPkg)) {
                    console.warn(`Plugin ${manifest.name} requires ${requiredPkg} to be loaded, loading now.`);
                    await this.loadPlugin(requiredPkg);
                }
            }
        }

        const context: IPluginContext = {
            manifest,
            events: this.eventBus,
        };

        const instance = new PluginClass(context);
        await instance.onLoad();
        this.plugins.set(manifest.name, instance);
    }

    async unLoadPlugin(id: string) {
        const instance = this.plugins.get(id);
        if (instance) {
            await instance.onUnload();
            this.plugins.delete(id);
            console.log(`[Host] Unloaded plugin ${id}`);
        }
    }
}
