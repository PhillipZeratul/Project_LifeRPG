import type { CentralEventBus } from "./central-event-bus";
import { PluginManager } from "./plugin-manager";
import { BUILTIN_PLUGINS, type PluginDefinition } from "./builtin-plugins";
import type { HostRpcBridge, IServiceRegistryQuery } from "./rpc-bridge";

export interface ServiceRegistration {
    id: string;
    name?: string;
    pluginId?: string;
    methods?: string[];
    enabled?: boolean;
    description?: string;
}

export interface CorePluginRegistration extends PluginDefinition {
    service?: {
        id: string;
        methods?: string[];
    };
}

export class CentralServiceRegistry implements IServiceRegistryQuery {
    private services = new Map<string, ServiceRegistration>();
    private methodToServiceMap = new Map<string, string>();
    private pluginToServiceMap = new Map<string, string>();
    private pluginManager: PluginManager;

    constructor(
        private bridge: HostRpcBridge,
        private eventBus: CentralEventBus,
        pluginManager?: PluginManager
    ) {
        this.pluginManager =
            pluginManager ?? new PluginManager(this.eventBus, this.bridge, this);

        this.bridge.setServiceRegistry(this);
        this.registerSystemHandlers();
        this.initBuiltinServices();
    }

    private initBuiltinServices(): void {
        for (const [id, def] of Object.entries(BUILTIN_PLUGINS)) {
            const shortId = id.replace(/^@liferpg\/plugin-core-/, "");
            this.registerService({
                id: shortId,
                name: def.manifest.displayName || shortId,
                pluginId: id,
                methods: [`${shortId}.start`, `${shortId}.stop`, `${shortId}.status`],
                enabled: false,
            });
            this.pluginToServiceMap.set(id, shortId);
        }
    }

    private registerSystemHandlers(): void {
        this.bridge.registerHandler(
            "system.isFeatureAvailable",
            (params: { feature?: string }) => {
                const feature = params?.feature ?? "";
                return { available: this.isAvailable(feature) };
            }
        );

        this.bridge.registerHandler(
            "system.isAvailable",
            (params: { feature?: string; service?: string; method?: string }) => {
                const target = params?.feature ?? params?.service ?? params?.method ?? "";
                return { available: this.isAvailable(target) };
            }
        );
    }

    public registerService(service: ServiceRegistration): void {
        const enabled = service.enabled ?? true;
        const entry: ServiceRegistration = {
            ...service,
            enabled,
        };

        this.services.set(service.id, entry);

        if (service.methods) {
            for (const method of service.methods) {
                this.methodToServiceMap.set(method, service.id);
            }
        }

        if (service.pluginId) {
            this.pluginToServiceMap.set(service.pluginId, service.id);
        }
    }

    public unregisterService(serviceId: string): void {
        const service = this.services.get(serviceId);
        if (!service) return;

        if (service.methods) {
            for (const method of service.methods) {
                this.methodToServiceMap.delete(method);
            }
        }
        if (service.pluginId) {
            this.pluginToServiceMap.delete(service.pluginId);
        }
        this.services.delete(serviceId);
    }

    public async enableService(serviceId: string): Promise<void> {
        const service = this.services.get(serviceId);
        if (service) {
            service.enabled = true;
            if (service.pluginId && !this.pluginManager.isPluginEnabled(service.pluginId)) {
                await this.pluginManager.enablePlugin(service.pluginId);
            }
        }
    }

    public async disableService(serviceId: string): Promise<void> {
        const service = this.services.get(serviceId);
        if (service) {
            service.enabled = false;
            if (service.pluginId && this.pluginManager.isPluginEnabled(service.pluginId)) {
                await this.pluginManager.disablePlugin(service.pluginId);
            }
        }
    }

    public isServiceEnabled(serviceId: string): boolean {
        const service = this.services.get(serviceId);
        return service ? Boolean(service.enabled) : false;
    }

    public isServiceDisabled(serviceId: string): boolean {
        const service = this.services.get(serviceId);
        return service ? !service.enabled : false;
    }

    public isMethodDisabled(method: string): boolean {
        const service = this.getServiceForMethod(method);
        if (service) {
            return this.isServiceDisabled(service.id);
        }
        return false;
    }

    public getServiceForMethod(method: string): { id: string; pluginId?: string } | undefined {
        const directServiceId = this.methodToServiceMap.get(method);
        if (directServiceId) {
            const svc = this.services.get(directServiceId);
            return svc ? { id: svc.id, pluginId: svc.pluginId } : undefined;
        }

        // Try prefix match (e.g., "timer.start" matches service "timer")
        for (const [id, svc] of this.services.entries()) {
            if (method.startsWith(`${id}.`)) {
                return { id: svc.id, pluginId: svc.pluginId };
            }
        }

        return undefined;
    }

    public registerPlugin(id: string, definition: CorePluginRegistration): void {
        this.pluginManager.registerPlugin(id, definition);

        const serviceId = definition.service?.id ?? id;
        const methods = definition.service?.methods ?? [];

        this.registerService({
            id: serviceId,
            name: definition.manifest.displayName || serviceId,
            pluginId: id,
            methods,
            enabled: false,
        });

        // If the serviceId differs from plugin id, also map plugin id directly
        if (serviceId !== id) {
            this.pluginToServiceMap.set(id, serviceId);
        }
    }

    public async enablePlugin(id: string): Promise<void> {
        await this.pluginManager.enablePlugin(id);
        const serviceId = this.pluginToServiceMap.get(id) ?? id;
        const service = this.services.get(serviceId);
        if (service) {
            service.enabled = true;
        }
    }

    public async disablePlugin(id: string): Promise<void> {
        await this.pluginManager.disablePlugin(id);
        const serviceId = this.pluginToServiceMap.get(id) ?? id;
        const service = this.services.get(serviceId);
        if (service) {
            service.enabled = false;
        }
    }

    public isAvailable(query: string): boolean {
        if (!query) return false;

        // 1. Check if direct service id
        const service = this.services.get(query);
        if (service) {
            return Boolean(service.enabled);
        }

        // 2. Check if plugin id
        if (this.pluginToServiceMap.has(query)) {
            const mappedServiceId = this.pluginToServiceMap.get(query)!;
            const mappedService = this.services.get(mappedServiceId);
            if (mappedService) {
                return Boolean(mappedService.enabled);
            }
        }

        if (this.pluginManager.hasPlugin(query)) {
            return this.pluginManager.isPluginEnabled(query);
        }

        // 3. Check if method name
        const serviceForMethod = this.getServiceForMethod(query);
        if (serviceForMethod) {
            return this.isServiceEnabled(serviceForMethod.id);
        }

        return false;
    }

    public getPluginManager(): PluginManager {
        return this.pluginManager;
    }
}
