import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    RpcClient,
    PermissionDeniedError,
    createMessageChannelTransportPair,
    RoutineEvents,
    type Routine,
    type TimeBlock,
    type DeleteEntityResult,
} from "@liferpg/sdk";
import RoutinePlugin from "@liferpg/plugin-core-routine";
import {
    HostRpcBridge,
    CentralEventBus,
    CentralServiceRegistry,
} from "../index";

describe("Routine & Time Block Core Plugin Seam (Host RPC Bridge)", () => {
    let bridge: HostRpcBridge;
    let eventBus: CentralEventBus;
    let serviceRegistry: CentralServiceRegistry;
    let cleanup: () => void;
    let client: RpcClient;

    beforeEach(async () => {
        RoutinePlugin.resetDefaultStore();
        bridge = new HostRpcBridge();
        eventBus = new CentralEventBus();
        serviceRegistry = new CentralServiceRegistry(bridge, eventBus);

        // Enable the routine plugin
        await serviceRegistry.enablePlugin("@liferpg/plugin-core-routine");

        // Client with full routine permissions
        const [hostTransport, clientTransport] = createMessageChannelTransportPair();
        const disconnect = bridge.connect(hostTransport, {
            callerId: "test-client",
            permissions: ["routines:read", "routines:write"],
        });
        client = new RpcClient(clientTransport);

        cleanup = () => {
            client.dispose();
            disconnect();
        };
    });

    afterEach(() => {
        cleanup?.();
    });

    describe("Routine CRUD Operations", () => {
        it("creates and retrieves a Routine", async () => {
            const created = await client.call<Routine>("routine.create", {
                name: "Weekday Rhythm",
                description: "Standard morning and evening routine",
                daysOfWeek: [1, 2, 3, 4, 5],
            });

            expect(created.id).toBeDefined();
            expect(created.name).toBe("Weekday Rhythm");
            expect(created.description).toBe("Standard morning and evening routine");
            expect(created.daysOfWeek).toEqual([1, 2, 3, 4, 5]);
            expect(created.timeBlocks).toEqual([]);
            expect(created.created_at).toBeGreaterThan(0);
            expect(created.updated_at).toBe(created.created_at);

            const fetched = await client.call<Routine>("routine.get", { id: created.id });
            expect(fetched).toEqual(created);
        });

        it("lists routines and filters by dayOfWeek", async () => {
            await client.call<Routine>("routine.create", {
                name: "Workday Routine",
                daysOfWeek: [1, 2, 3, 4, 5],
            });
            await client.call<Routine>("routine.create", {
                name: "Weekend Routine",
                daysOfWeek: [0, 6],
            });

            const all = await client.call<Routine[]>("routine.list");
            expect(all.length).toBe(2);

            // Filter for Sunday (0)
            const weekendOnly = await client.call<Routine[]>("routine.list", { dayOfWeek: 0 });
            expect(weekendOnly.length).toBe(1);
            expect(weekendOnly[0]!.name).toBe("Weekend Routine");

            // Filter for Wednesday (3)
            const workdayOnly = await client.call<Routine[]>("routine.list", { dayOfWeek: 3 });
            expect(workdayOnly.length).toBe(1);
            expect(workdayOnly[0]!.name).toBe("Workday Routine");
        });

        it("updates routine details with updated_at timestamp progression", async () => {
            const created = await client.call<Routine>("routine.create", {
                name: "Initial Name",
                daysOfWeek: [1],
            });

            const updated = await client.call<Routine>("routine.update", {
                id: created.id,
                name: "Updated Name",
                daysOfWeek: [1, 2],
            });

            expect(updated.name).toBe("Updated Name");
            expect(updated.daysOfWeek).toEqual([1, 2]);
            expect(updated.updated_at).toBeGreaterThanOrEqual(created.updated_at);

            const fetched = await client.call<Routine>("routine.get", { id: created.id });
            expect(fetched.name).toBe("Updated Name");
        });

        it("deletes a routine and its constituent blocks", async () => {
            const routine = await client.call<Routine>("routine.create", {
                name: "To Delete",
            });

            await client.call<TimeBlock>("routine.createTimeBlock", {
                routineId: routine.id,
                title: "Deep Work",
                startTime: "09:00",
                endTime: "10:30",
            });

            const delResult = await client.call<DeleteEntityResult>("routine.delete", {
                id: routine.id,
            });
            expect(delResult.success).toBe(true);
            expect(delResult.id).toBe(routine.id);

            // Getting deleted routine should fail or return not found
            await expect(client.call("routine.get", { id: routine.id })).rejects.toMatchObject({
                name: "RpcError",
                code: "NOT_FOUND",
            });
        });
    });

    describe("Time Block CRUD Operations & Relationship", () => {
        it("creates and attaches a Time Block to a Routine", async () => {
            const routine = await client.call<Routine>("routine.create", {
                name: "Daily Routine",
            });

            const timeBlock = await client.call<TimeBlock>("routine.createTimeBlock", {
                routineId: routine.id,
                title: "Morning Meditation",
                description: "Mindfulness focus block",
                startTime: "07:00",
                endTime: "07:30",
                color: "#4ade80",
            });

            expect(timeBlock.id).toBeDefined();
            expect(timeBlock.routineId).toBe(routine.id);
            expect(timeBlock.title).toBe("Morning Meditation");
            expect(timeBlock.startTime).toBe("07:00");
            expect(timeBlock.endTime).toBe("07:30");
            expect(timeBlock.created_at).toBeGreaterThan(0);
            expect(timeBlock.updated_at).toBe(timeBlock.created_at);

            // Routine should now contain this Time Block
            const fetchedRoutine = await client.call<Routine>("routine.get", { id: routine.id });
            expect(fetchedRoutine.timeBlocks.length).toBe(1);
            expect(fetchedRoutine.timeBlocks[0]!.id).toBe(timeBlock.id);
            expect(fetchedRoutine.timeBlocks[0]!.title).toBe("Morning Meditation");
        });

        it("updates and deletes a Time Block", async () => {
            const routine = await client.call<Routine>("routine.create", {
                name: "Daily Routine",
            });

            const tb = await client.call<TimeBlock>("routine.createTimeBlock", {
                routineId: routine.id,
                title: "Deep Work",
                startTime: "09:00",
                endTime: "11:00",
            });

            const updatedTb = await client.call<TimeBlock>("routine.updateTimeBlock", {
                id: tb.id,
                title: "Deep Work & Code Review",
                endTime: "11:30",
            });

            expect(updatedTb.title).toBe("Deep Work & Code Review");
            expect(updatedTb.endTime).toBe("11:30");

            const fetchedTb = await client.call<TimeBlock>("routine.getTimeBlock", { id: tb.id });
            expect(fetchedTb.title).toBe("Deep Work & Code Review");

            // Delete time block
            const delResult = await client.call<DeleteEntityResult>("routine.deleteTimeBlock", {
                id: tb.id,
            });
            expect(delResult.success).toBe(true);

            // Time block should no longer be in Routine
            const updatedRoutine = await client.call<Routine>("routine.get", { id: routine.id });
            expect(updatedRoutine.timeBlocks.length).toBe(0);
        });
    });

    describe("Row-Level Last-Write-Wins (LWW) Conflict Resolution", () => {
        it("accepts newer updates and ignores/rejects older out-of-order writes", async () => {
            const baseTime = 1700000000000;
            const routine = await client.call<Routine>("routine.create", {
                name: "Baseline Routine",
                created_at: baseTime,
                updated_at: baseTime,
            });

            // Write 1: Timestamp baseTime + 1000
            const write1 = await client.call<Routine>("routine.update", {
                id: routine.id,
                name: "Write 1 Name",
                updated_at: baseTime + 1000,
            });
            expect(write1.name).toBe("Write 1 Name");
            expect(write1.updated_at).toBe(baseTime + 1000);

            // Write 2 (Stale write): Timestamp baseTime + 500 (older than current updated_at)
            // LWW rule: Stale write should not overwrite newer state
            const staleWrite = await client.call<Routine>("routine.update", {
                id: routine.id,
                name: "Stale Write Should Not Win",
                updated_at: baseTime + 500,
            });
            // The stored record must retain "Write 1 Name" and updated_at = baseTime + 1000
            expect(staleWrite.name).toBe("Write 1 Name");
            expect(staleWrite.updated_at).toBe(baseTime + 1000);

            const fetched = await client.call<Routine>("routine.get", { id: routine.id });
            expect(fetched.name).toBe("Write 1 Name");
            expect(fetched.updated_at).toBe(baseTime + 1000);
        });

        it("applies LWW conflict resolution on Time Block entities", async () => {
            const baseTime = 1700000000000;
            const routine = await client.call<Routine>("routine.create", {
                name: "Routine",
            });

            const tb = await client.call<TimeBlock>("routine.createTimeBlock", {
                routineId: routine.id,
                title: "Original Block",
                startTime: "09:00",
                endTime: "10:00",
                created_at: baseTime,
                updated_at: baseTime,
            });

            // Newer write
            await client.call<TimeBlock>("routine.updateTimeBlock", {
                id: tb.id,
                title: "Newer Block Title",
                updated_at: baseTime + 2000,
            });

            // Out-of-order stale update with older timestamp
            const resultAfterStale = await client.call<TimeBlock>("routine.updateTimeBlock", {
                id: tb.id,
                title: "Old Stale Title",
                updated_at: baseTime + 1000,
            });

            expect(resultAfterStale.title).toBe("Newer Block Title");
            expect(resultAfterStale.updated_at).toBe(baseTime + 2000);
        });
    });

    describe("Permission Enforcement Seam", () => {
        it("blocks write operations when caller only has routines:read", async () => {
            const [hostTransport, readOnlyTransport] = createMessageChannelTransportPair();
            const disconnectReadOnly = bridge.connect(hostTransport, {
                callerId: "readonly-caller",
                permissions: ["routines:read"],
            });
            const readOnlyClient = new RpcClient(readOnlyTransport);

            // Reads are permitted
            const routines = await readOnlyClient.call<Routine[]>("routine.list");
            expect(Array.isArray(routines)).toBe(true);

            // Writes must be rejected with PermissionDeniedError
            await expect(
                readOnlyClient.call("routine.create", { name: "Unauthorized" })
            ).rejects.toBeInstanceOf(PermissionDeniedError);

            await expect(
                readOnlyClient.call("routine.update", { id: "123", name: "Unauthorized" })
            ).rejects.toBeInstanceOf(PermissionDeniedError);

            await expect(
                readOnlyClient.call("routine.delete", { id: "123" })
            ).rejects.toBeInstanceOf(PermissionDeniedError);

            await expect(
                readOnlyClient.call("routine.createTimeBlock", {
                    routineId: "123",
                    title: "Blocked",
                    startTime: "08:00",
                    endTime: "09:00",
                })
            ).rejects.toBeInstanceOf(PermissionDeniedError);

            readOnlyClient.dispose();
            disconnectReadOnly();
        });

        it("blocks read operations when caller lacks routines:read", async () => {
            const [hostTransport, unauthTransport] = createMessageChannelTransportPair();
            const disconnectUnauth = bridge.connect(hostTransport, {
                callerId: "unauthorized-caller",
                permissions: [],
            });
            const unauthClient = new RpcClient(unauthTransport);

            await expect(unauthClient.call("routine.list")).rejects.toBeInstanceOf(
                PermissionDeniedError
            );

            await expect(unauthClient.call("routine.get", { id: "123" })).rejects.toBeInstanceOf(
                PermissionDeniedError
            );

            unauthClient.dispose();
            disconnectUnauth();
        });
    });

    describe("Lifecycle & Graceful Degradation Seam", () => {
        it("degrades gracefully when routine plugin is disabled and restores upon re-enabling", async () => {
            // Routine is currently available
            expect(await client.isAvailable("routine")).toBe(true);
            expect(await client.isAvailable("routine.create")).toBe(true);

            // Create a routine while enabled
            const routine = await client.call<Routine>("routine.create", {
                name: "Pre-disable Routine",
            });
            expect(routine.id).toBeDefined();

            // Disable routine service
            await serviceRegistry.disableService("routine");

            // RPC availability drops
            expect(await client.isAvailable("routine")).toBe(false);
            expect(await client.isAvailable("routine.create")).toBe(false);

            // Calls reject with FEATURE_DISABLED
            await expect(client.call("routine.get", { id: routine.id })).rejects.toMatchObject({
                name: "FeatureDisabledError",
                feature: "routine",
            });

            // Re-enable
            await serviceRegistry.enableService("routine");
            expect(await client.isAvailable("routine")).toBe(true);

            // Can query pre-existing routine after re-enabling
            const fetched = await client.call<Routine>("routine.get", { id: routine.id });
            expect(fetched.name).toBe("Pre-disable Routine");
        });
    });

    describe("Event Emission & Observability Seam", () => {
        it("emits lifecycle events on CentralEventBus when mutations occur", async () => {
            const createdEvents: Routine[] = [];
            const updatedEvents: Routine[] = [];
            const deletedEvents: Array<{ id: string; routine: Routine }> = [];

            eventBus.on(RoutineEvents.Created, (r) => {
                createdEvents.push(r);
            });
            eventBus.on(RoutineEvents.Updated, (r) => {
                updatedEvents.push(r);
            });
            eventBus.on(RoutineEvents.Deleted, (e) => {
                deletedEvents.push(e);
            });

            const created = await client.call<Routine>("routine.create", {
                name: "Event Test Routine",
            });
            expect(createdEvents.length).toBe(1);
            expect(createdEvents[0]!.id).toBe(created.id);

            await client.call<Routine>("routine.update", {
                id: created.id,
                name: "Event Test Routine Updated",
            });
            expect(updatedEvents.length).toBe(1);
            expect(updatedEvents[0]!.name).toBe("Event Test Routine Updated");

            await client.call<DeleteEntityResult>("routine.delete", {
                id: created.id,
            });
            expect(deletedEvents.length).toBe(1);
            expect(deletedEvents[0]!.id).toBe(created.id);
        });
    });

    describe("Edge Cases & Schema Validation Handling", () => {
        it("rejects creating time block with invalid time format", async () => {
            const routine = await client.call<Routine>("routine.create", {
                name: "Routine",
            });

            await expect(
                client.call("routine.createTimeBlock", {
                    routineId: routine.id,
                    title: "Bad Time Block",
                    startTime: "25:99",
                    endTime: "10:00",
                })
            ).rejects.toMatchObject({
                code: "VALIDATION_FAILED",
            });
        });

        it("rejects creating time block for nonexistent parent routine", async () => {
            await expect(
                client.call("routine.createTimeBlock", {
                    routineId: "nonexistent-routine-id",
                    title: "Orphan Block",
                    startTime: "09:00",
                    endTime: "10:00",
                })
            ).rejects.toMatchObject({
                code: "NOT_FOUND",
            });
        });

        it("prevents stale update from resurrecting a deleted routine", async () => {
            const baseTime = 1700000000000;
            const routine = await client.call<Routine>("routine.create", {
                name: "Routine to be deleted",
                created_at: baseTime,
                updated_at: baseTime,
            });

            // Delete at baseTime + 2000
            await client.call<DeleteEntityResult>("routine.delete", {
                id: routine.id,
                updated_at: baseTime + 2000,
            });

            // Stale update at baseTime + 1000 should fail with NOT_FOUND
            await expect(
                client.call("routine.update", {
                    id: routine.id,
                    name: "Resurrection Attempt",
                    updated_at: baseTime + 1000,
                })
            ).rejects.toMatchObject({
                code: "NOT_FOUND",
            });
        });
    });
});
