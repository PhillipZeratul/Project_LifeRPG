import type {
    IRpcTransport,
    RpcMessage,
    RpcRequest,
    RpcResponse,
    RpcErrorPayload,
} from "@liferpg/sdk";

export type RpcHandler<TParams = unknown, TResult = unknown> = (
    params: TParams
) => Promise<TResult> | TResult;

export class HostRpcBridge {
    private handlers: Map<string, RpcHandler<never, unknown>> = new Map();

    public registerHandler<TParams = unknown, TResult = unknown>(
        method: string,
        handler: RpcHandler<TParams, TResult>
    ): void {
        this.handlers.set(method, handler as RpcHandler<never, unknown>);
    }

    public unregisterHandler(method: string): void {
        this.handlers.delete(method);
    }

    public hasHandler(method: string): boolean {
        return this.handlers.has(method);
    }

    public connect(transport: IRpcTransport): () => void {
        const unlisten = transport.onMessage(async (message: RpcMessage) => {
            if (message.type !== "request") {
                return;
            }

            const response = await this.dispatch(message);
            transport.send(response);
        });

        return unlisten;
    }

    public async dispatch(request: RpcRequest): Promise<RpcResponse> {
        const { id, method, params } = request;

        const handler = this.handlers.get(method);
        if (!handler) {
            return {
                type: "response",
                id,
                success: false,
                error: {
                    code: "METHOD_NOT_FOUND",
                    message: `Method '${method}' not found on Host Runtime RPC bridge`,
                },
            };
        }

        try {
            const result = await handler(params as never);
            return {
                type: "response",
                id,
                success: true,
                result,
            };
        } catch (error: unknown) {
            const errorPayload: RpcErrorPayload = {
                code: (error as { code?: string })?.code ?? "INTERNAL_ERROR",
                message: error instanceof Error ? error.message : String(error),
                data: (error as { data?: unknown })?.data,
            };

            return {
                type: "response",
                id,
                success: false,
                error: errorPayload,
            };
        }
    }
}
