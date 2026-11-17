import { RpcError, PermissionDeniedError } from "./errors";
import type { IRpcTransport, RpcId, RpcMessage, RpcRequest } from "./types";

export interface RpcClientOptions {
    timeoutMs?: number;
}

interface PendingRequest {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
}

export class RpcClient {
    private transport: IRpcTransport;
    private defaultTimeoutMs: number;
    private nextId: number = 1;
    private pendingRequests: Map<RpcId, PendingRequest> = new Map();
    private unlisten: () => void;
    private isDisposed: boolean = false;

    constructor(transport: IRpcTransport, options: RpcClientOptions = {}) {
        this.transport = transport;
        this.defaultTimeoutMs = options.timeoutMs ?? 5000;
        this.unlisten = this.transport.onMessage((message) => this.handleMessage(message));
    }

    private handleMessage(message: RpcMessage): void {
        if (message.type !== "response") {
            return;
        }

        const pending = this.pendingRequests.get(message.id);
        if (!pending) {
            return;
        }

        clearTimeout(pending.timer);
        this.pendingRequests.delete(message.id);

        if (message.success) {
            pending.resolve(message.result);
        } else {
            if (message.error.code === "PERMISSION_DENIED") {
                const data = message.error.data as
                    | { permission?: string; method?: string; callerId?: string }
                    | undefined;
                pending.reject(
                    new PermissionDeniedError({
                        message: message.error.message,
                        permission: data?.permission,
                        method: data?.method,
                        callerId: data?.callerId,
                        data: message.error.data,
                    })
                );
            } else {
                pending.reject(new RpcError(message.error));
            }
        }
    }

    public async call<TResult = unknown, TParams = unknown>(
        method: string,
        params?: TParams,
        timeoutMs?: number
    ): Promise<TResult> {
        if (this.isDisposed) {
            throw new RpcError({
                code: "DISPOSED",
                message: "RPC client has been disposed",
            });
        }

        const id = `req_${this.nextId++}`;
        const timeout = timeoutMs ?? this.defaultTimeoutMs;

        const request: RpcRequest<TParams> = {
            type: "request",
            id,
            method,
            params,
        };

        return new Promise<TResult>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(
                    new RpcError({
                        code: "TIMEOUT",
                        message: `RPC request '${method}' timed out after ${timeout}ms`,
                    })
                );
            }, timeout);

            this.pendingRequests.set(id, {
                resolve: resolve as (result: unknown) => void,
                reject,
                timer,
            });

            try {
                this.transport.send(request);
            } catch (err) {
                clearTimeout(timer);
                this.pendingRequests.delete(id);
                reject(err instanceof Error ? err : new Error(String(err)));
            }
        });
    }

    public dispose(): void {
        if (this.isDisposed) {
            return;
        }
        this.isDisposed = true;
        this.unlisten();

        for (const [, pending] of this.pendingRequests.entries()) {
            clearTimeout(pending.timer);
            pending.reject(
                new RpcError({
                    code: "DISPOSED",
                    message: "RPC client was disposed before response arrived",
                })
            );
        }
        this.pendingRequests.clear();
    }
}
