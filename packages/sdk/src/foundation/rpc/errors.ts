import type { RpcErrorPayload } from "./types";

export class RpcError extends Error {
    public readonly code: string;
    public readonly data?: unknown;

    constructor(payload: RpcErrorPayload) {
        super(payload.message);
        this.name = "RpcError";
        this.code = payload.code;
        this.data = payload.data;
    }
}
