import type { RpcErrorPayload } from "./types";

export class RpcError extends Error {
    public readonly code: string;
    public readonly data?: unknown;

    constructor(payload: RpcErrorPayload) {
        super(payload.message);
        this.name = "RpcError";
        this.code = payload.code;
        this.data = payload.data;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export interface PermissionDeniedErrorPayload {
    message?: string;
    permission?: string;
    method?: string;
    callerId?: string;
    data?: unknown;
}

export class PermissionDeniedError extends RpcError {
    public readonly permission?: string;
    public readonly method?: string;
    public readonly callerId?: string;

    constructor(payload: PermissionDeniedErrorPayload | string) {
        if (typeof payload === "string") {
            super({
                code: "PERMISSION_DENIED",
                message: payload,
            });
            this.name = "PermissionDeniedError";
        } else {
            const message =
                payload.message ??
                (payload.permission
                    ? `Permission denied: caller lacks required permission '${payload.permission}'${
                          payload.method ? ` for method '${payload.method}'` : ""
                      }`
                    : "Permission denied");

            super({
                code: "PERMISSION_DENIED",
                message,
                data: {
                    permission: payload.permission,
                    method: payload.method,
                    callerId: payload.callerId,
                    ...(typeof payload.data === "object" && payload.data !== null
                        ? (payload.data as Record<string, unknown>)
                        : {}),
                },
            });
            this.name = "PermissionDeniedError";
            this.permission = payload.permission;
            this.method = payload.method;
            this.callerId = payload.callerId;
        }
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
