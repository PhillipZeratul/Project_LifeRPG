import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  RpcClient,
  createMessageChannelTransportPair,
} from "@liferpg/sdk";
import { HostRpcBridge } from "../rpc-bridge";

describe("Host Runtime RPC Seam", () => {
  let bridge: HostRpcBridge;
  let client: RpcClient;
  let cleanup: () => void;

  beforeEach(() => {
    bridge = new HostRpcBridge();
    const [hostTransport, clientTransport] = createMessageChannelTransportPair();
    const disconnect = bridge.connect(hostTransport);
    client = new RpcClient(clientTransport);

    cleanup = () => {
      client.dispose();
      disconnect();
    };
  });

  afterEach(() => {
    cleanup();
  });

  it("dispatches a typed request and receives a verified response from Host Runtime", async () => {
    interface PingParams {
      message: string;
    }
    interface PingResult {
      reply: string;
      timestamp: number;
    }

    const fixedTimestamp = 1700000000000;
    bridge.registerHandler<PingParams, PingResult>("system.ping", (params) => {
      return {
        reply: `pong: ${params.message}`,
        timestamp: fixedTimestamp,
      };
    });

    const result = await client.call<PingResult, PingParams>("system.ping", {
      message: "hello host",
    });

    expect(result).toEqual({
      reply: "pong: hello host",
      timestamp: fixedTimestamp,
    });
  });

  it("returns a structured METHOD_NOT_FOUND error when invoking an unregistered method", async () => {
    await expect(client.call("nonexistent.method")).rejects.toMatchObject({
      name: "RpcError",
      code: "METHOD_NOT_FOUND",
      message: "Method 'nonexistent.method' not found on Host Runtime RPC bridge",
    });
  });

  it("propagates structured handler errors and custom codes across the bridge", async () => {
    bridge.registerHandler("tasks.create", () => {
      const err = new Error("Task title cannot be blank");
      (err as unknown as { code: string; data: { field: string } }).code = "VALIDATION_FAILED";
      (err as unknown as { data: { field: string } }).data = { field: "title" };
      throw err;
    });

    await expect(client.call("tasks.create")).rejects.toMatchObject({
      name: "RpcError",
      code: "VALIDATION_FAILED",
      message: "Task title cannot be blank",
      data: { field: "title" },
    });
  });

  it("handles multiple concurrent asynchronous requests without crosstalk", async () => {
    bridge.registerHandler<{ value: number; delayMs: number }, number>(
      "math.delayedDouble",
      async ({ value, delayMs }) => {
        if (delayMs > 0) {
          await new Promise((res) => setTimeout(res, delayMs));
        }
        return value * 2;
      }
    );

    // Send requests with inverted delays: 1st has higher delay, 2nd has lower delay
    const p1 = client.call<number, { value: number; delayMs: number }>("math.delayedDouble", {
      value: 10,
      delayMs: 25,
    });
    const p2 = client.call<number, { value: number; delayMs: number }>("math.delayedDouble", {
      value: 20,
      delayMs: 5,
    });
    const p3 = client.call<number, { value: number; delayMs: number }>("math.delayedDouble", {
      value: 30,
      delayMs: 15,
    });

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    expect(r1).toBe(20);
    expect(r2).toBe(40);
    expect(r3).toBe(60);
  });

  it("times out cleanly when handler takes longer than specified timeout", async () => {
    bridge.registerHandler("test.slow", async () => {
      await new Promise((res) => setTimeout(res, 100));
      return "done";
    });

    await expect(
      client.call("test.slow", undefined, 20)
    ).rejects.toMatchObject({
      name: "RpcError",
      code: "TIMEOUT",
    });
  });

  it("cleans up pending requests and transport listeners on disposal", async () => {
    bridge.registerHandler("test.hanging", () => {
      return new Promise(() => {}); // never resolves
    });

    const pendingCall = client.call("test.hanging");

    client.dispose();

    await expect(pendingCall).rejects.toMatchObject({
      name: "RpcError",
      code: "DISPOSED",
    });

    // Calling again after disposal immediately rejects
    await expect(client.call("system.ping")).rejects.toMatchObject({
      name: "RpcError",
      code: "DISPOSED",
    });
  });
});
