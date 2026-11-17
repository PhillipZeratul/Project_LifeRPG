import { describe, it, expect } from "vitest";
import {
  RpcClient,
  RpcError,
  PermissionDeniedError,
  FeatureDisabledError,
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

  it("deserializes typed FeatureDisabledError when invoking a disabled service", async () => {
    const [transportA, transportB] = createMessageChannelTransportPair();
    const client = new RpcClient(transportA);

    transportB.onMessage((msg) => {
      if (msg.type === "request") {
        transportB.send({
          type: "response",
          id: msg.id,
          success: false,
          error: {
            code: "FEATURE_DISABLED",
            message: "Feature 'timer' is currently disabled or unavailable",
            data: {
              feature: "timer",
              pluginId: "@liferpg/plugin-core-timer",
              method: "timer.start",
            },
          },
        });
      }
    });

    try {
      await client.call("timer.start");
      expect.unreachable("Should have thrown FeatureDisabledError");
    } catch (err) {
      expect(err).toBeInstanceOf(FeatureDisabledError);
      expect(err).toBeInstanceOf(RpcError);
      const disabledErr = err as FeatureDisabledError;
      expect(disabledErr.code).toBe("FEATURE_DISABLED");
      expect(disabledErr.feature).toBe("timer");
      expect(disabledErr.pluginId).toBe("@liferpg/plugin-core-timer");
      expect(disabledErr.message).toContain("disabled");
    } finally {
      client.dispose();
    }
  });

  describe("isAvailable() check", () => {
    it("returns true when host reports feature is available", async () => {
      const [transportA, transportB] = createMessageChannelTransportPair();
      const client = new RpcClient(transportA);

      transportB.onMessage((msg) => {
        if (msg.type === "request") {
          const req = msg as RpcRequest<{ feature: string }>;
          expect(req.method).toBe("system.isFeatureAvailable");
          expect(req.params?.feature).toBe("timer");
          transportB.send({
            type: "response",
            id: req.id,
            success: true,
            result: { available: true },
          });
        }
      });

      const isAvail = await client.isAvailable("timer");
      expect(isAvail).toBe(true);
      client.dispose();
    });

    it("returns false when host reports feature is disabled or not found", async () => {
      const [transportA, transportB] = createMessageChannelTransportPair();
      const client = new RpcClient(transportA);

      transportB.onMessage((msg) => {
        if (msg.type === "request") {
          const req = msg as RpcRequest<{ feature: string }>;
          transportB.send({
            type: "response",
            id: req.id,
            success: true,
            result: { available: false },
          });
        }
      });

      const isAvail = await client.isAvailable("disabled-plugin");
      expect(isAvail).toBe(false);
      client.dispose();
    });

    it("returns false gracefully if query fails or RPC method is not supported", async () => {
      const [transportA, transportB] = createMessageChannelTransportPair();
      const client = new RpcClient(transportA);

      transportB.onMessage((msg) => {
        if (msg.type === "request") {
          transportB.send({
            type: "response",
            id: msg.id,
            success: false,
            error: {
              code: "METHOD_NOT_FOUND",
              message: "Method 'system.isFeatureAvailable' not found",
            },
          });
        }
      });

      const isAvail = await client.isAvailable("unknown-feature");
      expect(isAvail).toBe(false);
      client.dispose();
    });
  });
});
