import type { IEventBus, EventCallback, IEventDefinition } from "@liferpg/sdk";

export class CentralEventBus implements IEventBus {
    protected listeners: Map<string, Set<EventCallback<never>>> = new Map();

    private getEventKey(event: IEventDefinition<unknown>): string {
        if (typeof event === "object" && event !== null && "type" in event) {
            return (event as { type: string }).type;
        }
        return String(event);
    }

    public on<T>(event: IEventDefinition<T>, callback: EventCallback<T>): () => void {
        const key = this.getEventKey(event);
        let handlers = this.listeners.get(key);
        if (!handlers) {
            handlers = new Set();
            this.listeners.set(key, handlers);
        }
        handlers.add(callback as EventCallback<never>);
        return () => this.off(event, callback);
    }

    public off<T>(event: IEventDefinition<T>, callback: EventCallback<T>): void {
        const key = this.getEventKey(event);
        const handlers = this.listeners.get(key);
        if (handlers) {
            handlers.delete(callback);
            if (handlers.size === 0) {
                this.listeners.delete(key);
            }
        }
    }

    public emit<T>(event: IEventDefinition<T>, payload: T): void {
        const key = this.getEventKey(event);
        const handlers = this.listeners.get(key);
        if (handlers) {
            handlers.forEach((callback) => {
                try {
                    const fn = callback as unknown as EventCallback<T>;
                    void fn(payload);
                } catch (error) {
                    console.error(`[Event Bus] Error occurred while emitting event '${key}':`, error);
                }
            });
        }
    }
}
