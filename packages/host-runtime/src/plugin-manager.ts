import { BasePlugin, type IPluginManifest } from "@liferpg/sdk";
import { CentralEventBus } from "./central-event-bus";
import { CORE_PLUGINS, type PluginDefinition } from "./core-plugins";
import { ScopedPluginContext } from "./scoped-plugin-context";
import type { HostRpcBridge } from "./rpc-bridge";
import type { CentralServiceRegistry } from "./central-service-registry";

export interface PluginRecord {
    id: string;
    manifest: IPluginManifest;
    definition: PluginDefinition;
    instance: BasePlugin | null;
    scopedContext: ScopedPluginContext | null;
    isEnabled: boolean;
}

export class PluginManager {
    private registry = new Map<string, PluginRecord>();

    constructor(
        private eventBus: CentralEventBus,
        private bridge?: HostRpcBridge,
        public readonly serviceRegistry?: CentralServiceRegistry,
    ) {
        for (const [id, def] of Object.entries(CORE_PLUGINS)) {
            this.registerPlugin(id, def);
        }
    }

    public registerPlugin(id: string, definition: PluginDefinition) {
        const existing = this.registry.get(id);
        if (!existing || !existing.isEnabled) {
            this.registry.set(id, {
                id,
                manifest: definition.manifest,
                definition,
                instance: null,
                scopedContext: null,
                isEnabled: false,
            });
        }
    }

    public hasPlugin(id: string): boolean {
        return this.registry.has(id);
    }

    public isPluginEnabled(id: string): boolean {
        return this.registry.get(id)?.isEnabled ?? false;
    }

    public async enablePlugin(id: string): Promise<void> {
        const record = this.registry.get(id);
        if (!record) {
            throw new Error(`Plugin with id ${id} is not registered.`);
        }
        if (record.isEnabled) {
            console.log(`Plugin ${id} is already enabled.`);
            return;
        }

        console.log(`[Host] Enabling plugin: ${record.manifest.displayName || id}`);

        // Lazy load
        const module = await record.definition.loader();
        const PluginClass = module.default;

        const scopedContext = new ScopedPluginContext(record.manifest, this.eventBus, this.bridge);
        const instance = new PluginClass(scopedContext);

        await instance.onLoad();

        record.instance = instance;
        record.scopedContext = scopedContext;
        record.isEnabled = true;
    }

    public async disablePlugin(id: string): Promise<void> {
        const record = this.registry.get(id);
        if (!record || !record.isEnabled) {
            return;
        }

        console.log(`[Host] Disabling plugin: ${record.manifest.displayName || id}`);

        if (record.instance) {
            await record.instance.onUnload();
        }

        if (record.scopedContext) {
            record.scopedContext.dispose();
        }

        record.instance = null;
        record.scopedContext = null;
        record.isEnabled = false;
    }

    public async togglePlugin(id: string): Promise<boolean> {
        const record = this.registry.get(id);
        if (!record) {
            throw new Error(`Plugin with id ${id} is not registered.`);
        }

        if (record.isEnabled) {
            await this.disablePlugin(id);
            return false;
        } else {
            await this.enablePlugin(id);
            return true;
        }
    }

    public getPlugins(): Array<{ id: string; manifest: IPluginManifest; isEnabled: boolean }> {
        return Array.from(this.registry.values()).map((r) => ({
            id: r.id,
            manifest: r.manifest,
            isEnabled: r.isEnabled,
        }));
    }
}
