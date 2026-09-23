import type { IServiceRegistry, IServiceToken } from "@liferpg/sdk";

export class CentralServiceRegistry implements IServiceRegistry {
    private services = new Map<IServiceToken<unknown>, unknown>();

    register<T>(token: IServiceToken<T>, implementation: T): void {
        if (this.services.has(token)) {
            console.warn(`[CentralServiceRegistry] Overwriting service [${token}]`);
        }
        this.services.set(token, implementation);
    }

    unregister(token: IServiceToken<unknown>): void {
        this.services.delete(token);
    }

    get<T>(token: IServiceToken<T>): T | undefined {
        return this.services.get(token) as T | undefined;
    }

    has(token: IServiceToken<unknown>): boolean {
        return this.services.has(token);
    }
}
