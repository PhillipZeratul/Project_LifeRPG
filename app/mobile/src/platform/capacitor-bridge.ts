import type { IPlatformBridge } from "@liferpg/sdk";

export class CapacitorPlatformBridge implements IPlatformBridge {
    private listeners = new Map<string, Set<(payload: unknown) => void>>();

    async openView(viewName: string): Promise<void> {
        window.location.hash = `#/${viewName}`;
    }

    emit(event: string, payload?: unknown): void {
        const handlers = this.listeners.get(event);
        if (handlers) {
            handlers.forEach((fn) => fn(payload));
        }
    }

    listen<T>(event: string, callback: (payload: T) => void): () => void {
        let set = this.listeners.get(event);
        if (!set) {
            set = new Set();
            this.listeners.set(event, set);
        }
        const handler = callback as unknown as (payload: unknown) => void;
        set.add(handler);

        return () => {
            set.delete(handler);
        };
    }
}
