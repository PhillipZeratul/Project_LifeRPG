import type { IRpcTransport, RpcMessage } from "./types";

export class InMemoryRpcTransport implements IRpcTransport {
    private peer?: InMemoryRpcTransport;
    private listeners: Set<(message: RpcMessage) => void> = new Set();

    public setPeer(peer: InMemoryRpcTransport): void {
        this.peer = peer;
    }

    public send(message: RpcMessage): void {
        if (!this.peer) {
            throw new Error("Transport peer is not connected");
        }
        // Deep copy message to simulate boundary serialization and prevent shared mutable references
        const clonedMessage = structuredClone(message);
        queueMicrotask(() => {
            this.peer?.dispatch(clonedMessage);
        });
    }

    public dispatch(message: RpcMessage): void {
        for (const listener of this.listeners) {
            listener(message);
        }
    }

    public onMessage(handler: (message: RpcMessage) => void): () => void {
        this.listeners.add(handler);
        return () => {
            this.listeners.delete(handler);
        };
    }
}

export function createMessageChannelTransportPair(): [IRpcTransport, IRpcTransport] {
    const transportA = new InMemoryRpcTransport();
    const transportB = new InMemoryRpcTransport();
    transportA.setPeer(transportB);
    transportB.setPeer(transportA);
    return [transportA, transportB];
}
