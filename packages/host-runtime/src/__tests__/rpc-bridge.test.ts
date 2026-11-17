import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RpcClient, PermissionDeniedError, createMessageChannelTransportPair } from "@liferpg/sdk";
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
            },
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

        await expect(client.call("test.slow", undefined, 20)).rejects.toMatchObject({
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

    describe("Capability-Gated Invocation & Permission Enforcement", () => {
        it("rejects unauthorized RPC calls with typed PermissionDeniedError without executing underlying handler", async () => {
            const handlerSpy = vi.fn().mockResolvedValue({ success: true });
            bridge.registerHandler("avatar.updateVisuals", handlerSpy, {
                requiredPermissions: ["avatar:write"],
            });

            // Connect an untrusted caller with only avatar:read
            const [hostTransport, untrustedTransport] = createMessageChannelTransportPair();
            const disconnectUntrusted = bridge.connect(hostTransport, {
                callerId: "untrusted-plugin",
                permissions: ["avatar:read"],
            });
            const untrustedClient = new RpcClient(untrustedTransport);

            try {
                await untrustedClient.call("avatar.updateVisuals", { color: "blue" });
                expect.unreachable("Should have been blocked with PermissionDeniedError");
            } catch (err) {
                expect(err).toBeInstanceOf(PermissionDeniedError);
                const permErr = err as PermissionDeniedError;
                expect(permErr.code).toBe("PERMISSION_DENIED");
                expect(permErr.permission).toBe("avatar:write");
                expect(permErr.callerId).toBe("untrusted-plugin");
                expect(permErr.method).toBe("avatar.updateVisuals");
                expect(permErr.message).toContain("avatar:write");
            }

            // Crucial security invariant: underlying service handler must NOT have executed
            expect(handlerSpy).not.toHaveBeenCalled();

            untrustedClient.dispose();
            disconnectUntrusted();
        });

        it("allows authorized RPC calls to proceed and return typed responses", async () => {
            interface TrackHabitParams {
                habitId: string;
                timestamp: number;
            }
            interface TrackHabitResult {
                streak: number;
                xpGranted: number;
            }

            const handlerSpy = vi.fn().mockImplementation((): TrackHabitResult => {
                return {
                    streak: 5,
                    xpGranted: 20,
                };
            });

            bridge.registerHandler<TrackHabitParams, TrackHabitResult>("habits.track", handlerSpy, {
                requiredPermissions: "habits:track",
            });

            const [hostTransport, authorizedTransport] = createMessageChannelTransportPair();
            const disconnect = bridge.connect(hostTransport, {
                callerId: "authorized-plugin",
                permissions: ["habits:track"],
            });
            const authorizedClient = new RpcClient(authorizedTransport);

            const result = await authorizedClient.call<TrackHabitResult, TrackHabitParams>("habits.track", {
                habitId: "habit-123",
                timestamp: 1700000000,
            });

            expect(result).toEqual({
                streak: 5,
                xpGranted: 20,
            });
            expect(handlerSpy).toHaveBeenCalledTimes(1);
            expect(handlerSpy).toHaveBeenCalledWith(
                { habitId: "habit-123", timestamp: 1700000000 },
                expect.objectContaining({
                    method: "habits.track",
                    caller: expect.objectContaining({
                        callerId: "authorized-plugin",
                        permissions: ["habits:track"],
                    }),
                }),
            );

            authorizedClient.dispose();
            disconnect();
        });

        it("requires caller to hold ALL required permissions when multiple capabilities are demanded", async () => {
            const handlerSpy = vi.fn().mockResolvedValue({ ok: true });
            bridge.registerHandler("skills.levelUp", handlerSpy, {
                requiredPermissions: ["skills:write", "xp:grant"],
            });

            // Caller only has skills:write, missing xp:grant
            const [hostTransport, partialTransport] = createMessageChannelTransportPair();
            const disconnectPartial = bridge.connect(hostTransport, {
                callerId: "partial-plugin",
                permissions: ["skills:write"],
            });
            const partialClient = new RpcClient(partialTransport);

            await expect(partialClient.call("skills.levelUp")).rejects.toMatchObject({
                name: "PermissionDeniedError",
                code: "PERMISSION_DENIED",
                permission: "xp:grant",
            });
            expect(handlerSpy).not.toHaveBeenCalled();

            partialClient.dispose();
            disconnectPartial();

            // Caller with both permissions succeeds
            const [hostTransport2, fullTransport] = createMessageChannelTransportPair();
            const disconnectFull = bridge.connect(hostTransport2, {
                callerId: "full-plugin",
                permissions: ["skills:write", "xp:grant"],
            });
            const fullClient = new RpcClient(fullTransport);

            const res = await fullClient.call("skills.levelUp");
            expect(res).toEqual({ ok: true });
            expect(handlerSpy).toHaveBeenCalledTimes(1);

            fullClient.dispose();
            disconnectFull();
        });

        it("respects domain wildcards and superuser wildcard permissions", async () => {
            const avatarReadSpy = vi.fn().mockResolvedValue({ name: "Knight" });
            const habitsReadSpy = vi.fn().mockResolvedValue({ count: 3 });

            bridge.registerHandler("avatar.getProfile", avatarReadSpy, {
                requiredPermissions: "avatar:read",
            });
            bridge.registerHandler("habits.list", habitsReadSpy, {
                requiredPermissions: "habits:read",
            });

            // Caller with avatar:* can access avatar.getProfile but not habits.list
            const [hostTransport, wildcardTransport] = createMessageChannelTransportPair();
            const disconnectWildcard = bridge.connect(hostTransport, {
                callerId: "avatar-manager-plugin",
                permissions: ["avatar:*"],
            });
            const wildcardClient = new RpcClient(wildcardTransport);

            const avatarRes = await wildcardClient.call("avatar.getProfile");
            expect(avatarRes).toEqual({ name: "Knight" });
            expect(avatarReadSpy).toHaveBeenCalledTimes(1);

            await expect(wildcardClient.call("habits.list")).rejects.toMatchObject({
                name: "PermissionDeniedError",
                code: "PERMISSION_DENIED",
                permission: "habits:read",
            });
            expect(habitsReadSpy).not.toHaveBeenCalled();

            wildcardClient.dispose();
            disconnectWildcard();

            // Superuser caller with * can access anything
            const [hostTransportAdmin, adminTransport] = createMessageChannelTransportPair();
            const disconnectAdmin = bridge.connect(hostTransportAdmin, {
                callerId: "admin-plugin",
                permissions: ["*"],
            });
            const adminClient = new RpcClient(adminTransport);

            const habitsRes = await adminClient.call("habits.list");
            expect(habitsRes).toEqual({ count: 3 });
            expect(habitsReadSpy).toHaveBeenCalledTimes(1);

            adminClient.dispose();
            disconnectAdmin();
        });

        it("permits unauthenticated and permissionless callers to access unrestricted methods", async () => {
            bridge.registerHandler("system.version", () => "1.0.0");

            const [hostTransport, openTransport] = createMessageChannelTransportPair();
            const disconnect = bridge.connect(hostTransport);
            const openClient = new RpcClient(openTransport);

            const version = await openClient.call("system.version");
            expect(version).toBe("1.0.0");

            openClient.dispose();
            disconnect();
        });
    });
});
