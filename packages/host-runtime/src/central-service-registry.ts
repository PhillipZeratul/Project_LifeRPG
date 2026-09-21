import type { IServiceRegistry } from "@liferpg/sdk";

export class CentralServiceRegistry implements IServiceRegistry {
    private services = new Map<string, unknown>();

    register<T>(id: string, implementation: T): void {
        if (this.services.has(id)) {
            console.warn(`[CentralServiceRegistry] Overwriting service [${id}]`);
        }
        this.services.set(id, implementation);
    }

    unregister(id: string): void {
        this.services.delete(id);
    }

    get<T>(id: string): T | undefined {
        return this.services.get(id) as T | undefined;
    }

    has(id: string): boolean {
        return this.services.has(id);
    }
}