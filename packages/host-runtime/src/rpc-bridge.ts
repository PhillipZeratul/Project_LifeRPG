import type {
    IRpcTransport,
    RpcMessage,
    RpcRequest,
    RpcResponse,
    RpcErrorPayload,
    PluginPermission,
} from "@liferpg/sdk";

export interface CallerContext {
    callerId?: string;
    permissions?: readonly string[];
}

export interface BridgeConnectionOptions {
    callerId?: string;
    permissions?: readonly string[];
}

export interface RpcHandlerContext {
    caller?: CallerContext;
    method: string;
}

export interface RpcHandlerOptions {
    requiredPermissions?: PluginPermission[] | PluginPermission;
    serviceId?: string;
    pluginId?: string;
}

export type RpcHandler<TParams = unknown, TResult = unknown> = (
    params: TParams,
    context: RpcHandlerContext
) => Promise<TResult> | TResult;

export interface IServiceRegistryQuery {
    isMethodDisabled(method: string): boolean;
    isServiceDisabled?(serviceId: string): boolean;
    getServiceForMethod?(method: string): { id: string; pluginId?: string } | undefined;
    isAvailable?(query: string): boolean;
}

interface HandlerRecord {
    handler: RpcHandler<never, unknown>;
    requiredPermissions: string[];
    serviceId?: string;
    pluginId?: string;
}

function matchesPermission(granted: string, required: string): boolean {
    if (granted === "*" || granted === required) {
        return true;
    }
    if (granted.endsWith(":*")) {
        const grantedDomain = granted.slice(0, -2);
        const [requiredDomain] = required.split(":");
        if (grantedDomain === requiredDomain) {
            return true;
        }
    }
    return false;
}

function hasPermission(callerPermissions: readonly string[], required: string): boolean {
    return callerPermissions.some((granted) => matchesPermission(granted, required));
}

export class HostRpcBridge {
    private handlers: Map<string, HandlerRecord> = new Map();
    private serviceRegistry?: IServiceRegistryQuery;

    public setServiceRegistry(registry: IServiceRegistryQuery): void {
        this.serviceRegistry = registry;
    }

    public registerHandler<TParams = unknown, TResult = unknown>(
        method: string,
        handler: RpcHandler<TParams, TResult>,
        options?: RpcHandlerOptions
    ): void {
        let requiredPermissions: string[] = [];
        if (options?.requiredPermissions) {
            requiredPermissions = Array.isArray(options.requiredPermissions)
                ? [...options.requiredPermissions]
                : [options.requiredPermissions];
        }

        this.handlers.set(method, {
            handler: handler as RpcHandler<never, unknown>,
            requiredPermissions,
            serviceId: options?.serviceId,
            pluginId: options?.pluginId,
        });
    }

    public unregisterHandler(method: string): void {
        this.handlers.delete(method);
    }

    public hasHandler(method: string): boolean {
        return this.handlers.has(method);
    }

    public getRequiredPermissions(method: string): string[] | undefined {
        const record = this.handlers.get(method);
        return record ? [...record.requiredPermissions] : undefined;
    }

    public connect(transport: IRpcTransport, options?: BridgeConnectionOptions): () => void {
        const caller: CallerContext = {
            callerId: options?.callerId,
            permissions: options?.permissions ?? [],
        };

        const unlisten = transport.onMessage(async (message: RpcMessage) => {
            if (message.type !== "request") {
                return;
            }

            const response = await this.dispatch(message, caller);
            transport.send(response);
        });

        return unlisten;
    }

    public async dispatch(request: RpcRequest, caller?: CallerContext): Promise<RpcResponse> {
        const { id, method, params } = request;

        const record = this.handlers.get(method);
        if (!record) {
            if (this.serviceRegistry?.isMethodDisabled(method)) {
                const service = this.serviceRegistry.getServiceForMethod?.(method);
                const feature = service?.id ?? method;
                return {
                    type: "response",
                    id,
                    success: false,
                    error: {
                        code: "FEATURE_DISABLED",
                        message: `Feature '${feature}' is currently disabled or unavailable`,
                        data: {
                            feature,
                            method,
                            pluginId: service?.pluginId,
                        },
                    },
                };
            }

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

        if (
            (record.serviceId && this.serviceRegistry?.isServiceDisabled?.(record.serviceId)) ||
            this.serviceRegistry?.isMethodDisabled(method)
        ) {
            const service = this.serviceRegistry.getServiceForMethod?.(method);
            const feature = record.serviceId ?? service?.id ?? method;
            return {
                type: "response",
                id,
                success: false,
                error: {
                    code: "FEATURE_DISABLED",
                    message: `Feature '${feature}' is currently disabled or unavailable`,
                    data: {
                        feature,
                        method,
                        pluginId: record.pluginId ?? service?.pluginId,
                    },
                },
            };
        }

        // Validate permissions against caller context
        if (record.requiredPermissions.length > 0) {
            const callerPermissions = caller?.permissions ?? [];
            const missingPermission = record.requiredPermissions.find(
                (reqPerm) => !hasPermission(callerPermissions, reqPerm)
            );

            if (missingPermission) {
                const callerDesc = caller?.callerId ? `'${caller.callerId}'` : "anonymous";
                return {
                    type: "response",
                    id,
                    success: false,
                    error: {
                        code: "PERMISSION_DENIED",
                        message: `Caller ${callerDesc} lacks required permission '${missingPermission}' for method '${method}'`,
                        data: {
                            permission: missingPermission,
                            method,
                            callerId: caller?.callerId,
                        },
                    },
                };
            }
        }

        try {
            const context: RpcHandlerContext = {
                caller,
                method,
            };
            const result = await record.handler(params as never, context);
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
