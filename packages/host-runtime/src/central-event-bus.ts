import type { IEventBus, EventCallback, IEventDefinition } from "@liferpg/sdk";

export class CentralEventBus implements IEventBus {
    protected listeners: Map<IEventDefinition<unknown>, Set<EventCallback<never>>> = new Map();

    public on<T>(event: IEventDefinition<T>, callback: EventCallback<T>): () => void {
        let handlers = this.listeners.get(event);
        if (!handlers) {
            handlers = new Set();
            this.listeners.set(event, handlers);
        }
        handlers.add(callback as EventCallback<never>);
        return () => this.off(event, callback);
    }

    public off<T>(event: IEventDefinition<T>, callback: EventCallback<T>): void {
        const handlers = this.listeners.get(event);
        if (handlers) {
            handlers.delete(callback);
            if (handlers.size === 0) {
                this.listeners.delete(event);
            }
        }
    }

    public emit<T>(event: IEventDefinition<T>, payload: T): void {
        const handlers = this.listeners.get(event);
        if (handlers) {
            handlers.forEach((callback) => {
                try {
                    const fn = callback as unknown as EventCallback<T>;
                    void fn(payload);
                } catch (error) {
                    console.error(`[Event Bus] Error occurred while emitting event '${event}':`, error);
                }
            });
        }
    }
}
