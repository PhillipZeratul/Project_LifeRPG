export type RpcId = string | number;

export interface RpcRequest<TParams = unknown> {
    type: "request";
    id: RpcId;
    method: string;
    params?: TParams;
}

export interface RpcSuccessResponse<TResult = unknown> {
    type: "response";
    id: RpcId;
    success: true;
    result: TResult;
}

export interface RpcErrorPayload {
    code: string;
    message: string;
    data?: unknown;
}

export interface RpcErrorResponse {
    type: "response";
    id: RpcId;
    success: false;
    error: RpcErrorPayload;
}

export type RpcResponse<TResult = unknown> = RpcSuccessResponse<TResult> | RpcErrorResponse;

export type RpcMessage = RpcRequest | RpcResponse;

export interface IRpcTransport {
    send(message: RpcMessage): void;
    onMessage(handler: (message: RpcMessage) => void): () => void;
}

export interface IFeatureAvailability {
    isAvailable(feature: string): Promise<boolean>;
}
