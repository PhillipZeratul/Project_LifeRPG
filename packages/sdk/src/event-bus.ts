import type { IEventBus, EventCallback } from './types';

export abstract class BaseEventBus implements IEventBus {

    protected listeners: Map<string, Set<EventCallback<never>>> = new Map();

    protected addListener<T = unknown>(event: string, callback: EventCallback<T>): void {
        let handlers = this.listeners.get(event);
        if (!handlers) {
            handlers = new Set();
            this.listeners.set(event, handlers);
        }
        handlers.add(callback as EventCallback<never>);
    }

    public on<T = unknown>(event: string, callback: EventCallback<T>): () => void {
        this.addListener(event, callback);
        return () => this.off(event, callback);
    }

    public off<T = unknown>(event: string, callback: EventCallback<T>): void {
        const handlers = this.listeners.get(event);
        if (handlers) {
            handlers.delete(callback);
            if (handlers.size === 0) {
                this.listeners.delete(event);
            }
        }
    }

    public emit<T = unknown>(event: string, payload: T): void {
        const handlers = this.listeners.get(event);
        if (handlers) {
            handlers.forEach((callback) => {
                try {
                    const fn = callback as unknown as EventCallback<T>;
                    void fn(payload);
                } catch (error) {
                    console.error(`[Event Bus] Error occurred while emitting event '${event}':`, error);
                }
            })
        }
    }
}