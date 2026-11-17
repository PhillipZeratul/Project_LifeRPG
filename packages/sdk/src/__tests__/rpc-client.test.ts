import { describe, it, expect } from "vitest";
import {
  RpcClient,
  RpcError,
  PermissionDeniedError,
  createMessageChannelTransportPair,
  type RpcRequest,
} from "../foundation/rpc";

describe("RpcClient & Transport", () => {
  it("sends requests and receives responses through paired transports", async () => {
    const [transportA, transportB] = createMessageChannelTransportPair();
    const client = new RpcClient(transportA);

    transportB.onMessage((msg) => {
      if (msg.type === "request") {
        const req = msg as RpcRequest<{ echo: string }>;
        transportB.send({
          type: "response",
          id: req.id,
          success: true,
          result: { echo: req.params?.echo },
        });
      }
    });

    const res = await client.call<{ echo: string }, { echo: string }>("echo", {
      echo: "test-data",
    });

    expect(res).toEqual({ echo: "test-data" });
    client.dispose();
  });

  it("deserializes RpcError correctly on failed response", async () => {
    const [transportA, transportB] = createMessageChannelTransportPair();
    const client = new RpcClient(transportA);

    transportB.onMessage((msg) => {
      if (msg.type === "request") {
        transportB.send({
          type: "response",
          id: msg.id,
          success: false,
          error: {
            code: "CUSTOM_ERROR",
            message: "Something failed",
            data: { detail: 123 },
          },
        });
      }
    });

    try {
      await client.call("fail");
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(RpcError);
      const rpcErr = err as RpcError;
      expect(rpcErr.code).toBe("CUSTOM_ERROR");
      expect(rpcErr.message).toBe("Something failed");
      expect(rpcErr.data).toEqual({ detail: 123 });
    } finally {
      client.dispose();
    }
  });

  it("deserializes typed PermissionDeniedError on unauthorized RPC response", async () => {
    const [transportA, transportB] = createMessageChannelTransportPair();
    const client = new RpcClient(transportA);

    transportB.onMessage((msg) => {
      if (msg.type === "request") {
        transportB.send({
          type: "response",
          id: msg.id,
          success: false,
          error: {
            code: "PERMISSION_DENIED",
            message: "Caller lacks required permission 'avatar:read' for method 'avatar.getProfile'",
            data: {
              permission: "avatar:read",
              method: "avatar.getProfile",
              callerId: "untrusted-plugin",
            },
          },
        });
      }
    });

    try {
      await client.call("avatar.getProfile");
      expect.unreachable("Should have thrown PermissionDeniedError");
    } catch (err) {
      expect(err).toBeInstanceOf(PermissionDeniedError);
      expect(err).toBeInstanceOf(RpcError);
      const permErr = err as PermissionDeniedError;
      expect(permErr.code).toBe("PERMISSION_DENIED");
      expect(permErr.permission).toBe("avatar:read");
      expect(permErr.method).toBe("avatar.getProfile");
      expect(permErr.callerId).toBe("untrusted-plugin");
      expect(permErr.message).toContain("avatar:read");
    } finally {
      client.dispose();
    }
  });
});
