import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    RpcClient,
    PermissionDeniedError,
    FeatureDisabledError,
    createMessageChannelTransportPair,
    TaskEvents,
    type Task,
    type CompleteTaskResult,
    type TaskDeleteResult,
    type AvatarGetResult,
} from "@liferpg/sdk";
import TaskPlugin from "@liferpg/plugin-core-task";
import {
    HostRpcBridge,
    CentralEventBus,
    CentralServiceRegistry,
    AvatarService,
    InMemoryProgressionStore,
    registerAvatarRpcHandlers,
    wireTaskProgressionIntegration,
} from "../index";

describe("Task Core Plugin Seam (Host RPC Bridge & Avatar Progression)", () => {
    let bridge: HostRpcBridge;
    let eventBus: CentralEventBus;
    let serviceRegistry: CentralServiceRegistry;
    let progressionStore: InMemoryProgressionStore;
    let avatarService: AvatarService;
    let client: RpcClient;
    let cleanup: () => void;
    let unhookProgression: () => void;

    beforeEach(async () => {
        TaskPlugin.resetDefaultStore();
        bridge = new HostRpcBridge();
        eventBus = new CentralEventBus();
        progressionStore = new InMemoryProgressionStore();
        avatarService = new AvatarService(progressionStore);

        registerAvatarRpcHandlers(bridge, avatarService);
        unhookProgression = wireTaskProgressionIntegration(eventBus, avatarService);

        serviceRegistry = new CentralServiceRegistry(bridge, eventBus);

        // Enable Task plugin
        await serviceRegistry.enablePlugin("@liferpg/plugin-core-task");

        // Client with full permissions
        const [hostTransport, clientTransport] = createMessageChannelTransportPair();
        const disconnect = bridge.connect(hostTransport, {
            callerId: "test-client",
            permissions: ["tasks:read", "tasks:write"],
        });
        client = new RpcClient(clientTransport);

        cleanup = () => {
            unhookProgression?.();
            client.dispose();
            disconnect();
        };
    });

    afterEach(() => {
        cleanup?.();
    });

    describe("Task CRUD Operations (LWW Synchronization)", () => {
        it("creates and retrieves a standalone Task (unscheduled)", async () => {
            const created = await client.call<Task>("task.create", {
                title: "Draft Design Spec",
                description: "Outline requirements for plugin SDK",
                statId: "intellect",
                xpReward: 30,
            });

            expect(created.id).toBeDefined();
            expect(created.title).toBe("Draft Design Spec");
            expect(created.description).toBe("Outline requirements for plugin SDK");
            expect(created.statId).toBe("intellect");
            expect(created.xpReward).toBe(30);
            expect(created.completed).toBe(false);
            expect(created.timeBlockId).toBeUndefined();
            expect(created.created_at).toBeGreaterThan(0);
            expect(created.updated_at).toBe(created.created_at);

            const fetched = await client.call<Task>("task.get", { id: created.id });
            expect(fetched).toEqual(created);
        });

        it("creates a Task scheduled within a single Time Block", async () => {
            const timeBlockId = "tb-morning-focus";
            const task = await client.call<Task>("task.create", {
                title: "Code review PR #42",
                timeBlockId,
                statId: "focus",
                xpReward: 20,
            });

            expect(task.id).toBeDefined();
            expect(task.timeBlockId).toBe(timeBlockId);

            const list = await client.call<Task[]>("task.list", { timeBlockId });
            expect(list.length).toBe(1);
            expect(list[0]?.id).toBe(task.id);
        });

        it("creates a Task spanning multiple Time Blocks", async () => {
            const timeBlockIds = ["tb-block-1", "tb-block-2"];
            const task = await client.call<Task>("task.create", {
                title: "Major refactoring",
                timeBlockIds,
                statId: "focus",
                xpReward: 50,
            });

            expect(task.id).toBeDefined();
            expect(task.timeBlockIds).toEqual(timeBlockIds);

            const fetched = await client.call<Task>("task.get", { id: task.id });
            expect(fetched.timeBlockIds).toEqual(timeBlockIds);
        });

        it("creates a standalone Task on Calendar with dueDate and dueTime", async () => {
            const task = await client.call<Task>("task.create", {
                title: "Dentist appointment",
                dueDate: "2026-11-20",
                dueTime: "15:00",
                statId: "vitality",
                xpReward: 15,
            });

            expect(task.dueDate).toBe("2026-11-20");
            expect(task.dueTime).toBe("15:00");

            const list = await client.call<Task[]>("task.list", { dueDate: "2026-11-20" });
            expect(list.some((t) => t.id === task.id)).toBe(true);
        });

        it("updates Task details with higher updated_at (LWW)", async () => {
            const created = await client.call<Task>("task.create", {
                title: "Original Title",
                created_at: 1000,
                updated_at: 1000,
            });

            const updated = await client.call<Task>("task.update", {
                id: created.id,
                title: "Updated Title",
                updated_at: 2000,
            });

            expect(updated.title).toBe("Updated Title");
            expect(updated.updated_at).toBe(2000);

            const fetched = await client.call<Task>("task.get", { id: created.id });
            expect(fetched.title).toBe("Updated Title");
        });

        it("suppresses stale update with lower updated_at under LWW", async () => {
            const created = await client.call<Task>("task.create", {
                title: "Fresh Title",
                created_at: 5000,
                updated_at: 5000,
            });

            // Attempt write with older timestamp (4000 < 5000)
            const result = await client.call<Task>("task.update", {
                id: created.id,
                title: "Stale Title",
                updated_at: 4000,
            });

            expect(result.title).toBe("Fresh Title");
            expect(result.updated_at).toBe(5000);

            const fetched = await client.call<Task>("task.get", { id: created.id });
            expect(fetched.title).toBe("Fresh Title");
        });

        it("deletes a Task with tombstone and rejects resurrecting with older timestamp", async () => {
            const created = await client.call<Task>("task.create", {
                title: "Ephemeral Task",
                created_at: 1000,
                updated_at: 1000,
            });

            const deleteResult = await client.call<TaskDeleteResult>("task.delete", {
                id: created.id,
                updated_at: 2000,
            });
            expect(deleteResult.success).toBe(true);
            expect(deleteResult.id).toBe(created.id);

            await expect(client.call("task.get", { id: created.id })).rejects.toThrow(/not found/i);

            // Attempt recreate with older timestamp (1500 < 2000)
            await expect(
                client.call("task.create", {
                    id: created.id,
                    title: "Resurrected Task",
                    created_at: 1500,
                    updated_at: 1500,
                }),
            ).rejects.toThrow(/deleted/i);
        });
    });

    describe("Task Scheduling & Calendar Anchoring", () => {
        it("schedules an existing unscheduled task into a Time Block", async () => {
            const task = await client.call<Task>("task.create", {
                title: "Organize notes",
            });
            expect(task.timeBlockId).toBeUndefined();

            const scheduled = await client.call<Task>("task.schedule", {
                id: task.id,
                timeBlockId: "tb-afternoon-routine",
                dueDate: "2026-11-17",
            });

            expect(scheduled.timeBlockId).toBe("tb-afternoon-routine");
            expect(scheduled.dueDate).toBe("2026-11-17");

            const fetched = await client.call<Task>("task.get", { id: task.id });
            expect(fetched.timeBlockId).toBe("tb-afternoon-routine");
        });

        it("unanchors a task from a Time Block by setting timeBlockId to null", async () => {
            const task = await client.call<Task>("task.create", {
                title: "Write blog post",
                timeBlockId: "tb-morning",
            });

            const unanchored = await client.call<Task>("task.schedule", {
                id: task.id,
                timeBlockId: null,
            });

            expect(unanchored.timeBlockId).toBeNull();
        });

        it("emits task:scheduled event on CentralEventBus", async () => {
            const receivedEvents: unknown[] = [];
            eventBus.on(TaskEvents.Scheduled, (evt) => {
                receivedEvents.push(evt);
            });

            const task = await client.call<Task>("task.create", {
                title: "Research event bus",
            });

            await client.call("task.schedule", {
                id: task.id,
                timeBlockId: "tb-evening",
            });

            expect(receivedEvents.length).toBe(1);
            const eventPayload = receivedEvents[0] as { task: Task };
            expect(eventPayload.task.id).toBe(task.id);
            expect(eventPayload.task.timeBlockId).toBe("tb-evening");
        });
    });

    describe("Task Completion & Avatar Progression", () => {
        it("completes a Task, updates mutable state, and awards additive Avatar XP", async () => {
            const avatarId = "avatar-warrior";
            const task = await client.call<Task>("task.create", {
                title: "Morning 5km Run",
                statId: "vitality",
                xpReward: 40,
            });

            const completeResult = await client.call<CompleteTaskResult>("task.complete", {
                id: task.id,
                avatarId,
                notes: "Completed in 25 mins",
            });

            expect(completeResult.task.completed).toBe(true);
            expect(completeResult.task.completedAt).toBeGreaterThan(0);
            expect(completeResult.xpAwarded).toBe(40);
            expect(completeResult.avatarId).toBe(avatarId);

            // Verify task state in store
            const fetched = await client.call<Task>("task.get", { id: task.id });
            expect(fetched.completed).toBe(true);
            expect(fetched.completedAt).toBe(completeResult.task.completedAt);

            // Verify Avatar progression state
            const avatarState = await client.call<AvatarGetResult>("avatar.get", { avatarId });
            expect(avatarState.progression.totalXp).toBe(40);
            expect(avatarState.progression.stats["vitality"]).toBeDefined();
            expect(avatarState.progression.stats["vitality"]!.totalXp).toBe(40);

            // Complete a second task -> strictly additive XP
            const task2 = await client.call<Task>("task.create", {
                title: "Read Book Chapter",
                statId: "intellect",
                xpReward: 25,
            });

            await client.call("task.complete", {
                id: task2.id,
                avatarId,
            });

            const updatedAvatarState = await client.call<AvatarGetResult>("avatar.get", { avatarId });
            expect(updatedAvatarState.progression.totalXp).toBe(65);
            expect(updatedAvatarState.progression.stats["intellect"]!.totalXp).toBe(25);
            expect(updatedAvatarState.progression.stats["vitality"]!.totalXp).toBe(40);
        });

        it("emits task:completed event on CentralEventBus", async () => {
            const receivedEvents: unknown[] = [];
            eventBus.on(TaskEvents.Completed, (evt) => {
                receivedEvents.push(evt);
            });

            const task = await client.call<Task>("task.create", {
                title: "Study TypeScript",
                statId: "intellect",
                xpReward: 35,
            });

            await client.call("task.complete", {
                id: task.id,
                avatarId: "avatar-student",
                notes: "Read utility types chapter",
            });

            expect(receivedEvents.length).toBe(1);
            const evt = receivedEvents[0] as { task: Task; xpAwarded: number; statId?: string; notes?: string };
            expect(evt.task.id).toBe(task.id);
            expect(evt.xpAwarded).toBe(35);
            expect(evt.statId).toBe("intellect");
            expect(evt.notes).toBe("Read utility types chapter");
        });

        it("does not award duplicate XP or emit task:completed event when re-completing an already completed task", async () => {
            const avatarId = "avatar-repeat-test";
            const task = await client.call<Task>("task.create", {
                title: "One-time Task",
                xpReward: 50,
            });

            const receivedEvents: unknown[] = [];
            eventBus.on(TaskEvents.Completed, (evt) => {
                receivedEvents.push(evt);
            });

            // First completion
            const firstComplete = await client.call<CompleteTaskResult>("task.complete", {
                id: task.id,
                avatarId,
            });
            expect(firstComplete.xpAwarded).toBe(50);
            expect(firstComplete.task.completed).toBe(true);
            expect(receivedEvents.length).toBe(1);

            // Re-completion attempt
            const secondComplete = await client.call<CompleteTaskResult>("task.complete", {
                id: task.id,
                avatarId,
            });
            expect(secondComplete.xpAwarded).toBe(0);
            expect(receivedEvents.length).toBe(1); // No new event emitted

            // Verify avatar XP was not awarded a second time
            const avatarState = await client.call<AvatarGetResult>("avatar.get", { avatarId });
            expect(avatarState.progression.totalXp).toBe(50);
        });

        it("does not complete task, award XP, or emit event on stale LWW completion update", async () => {
            const avatarId = "avatar-stale-test";
            const task = await client.call<Task>("task.create", {
                title: "Future Task",
                xpReward: 30,
                created_at: 10000,
                updated_at: 10000,
            });

            const receivedEvents: unknown[] = [];
            eventBus.on(TaskEvents.Completed, (evt) => {
                receivedEvents.push(evt);
            });

            // Attempt completion with older updated_at (stale)
            const staleComplete = await client.call<CompleteTaskResult>("task.complete", {
                id: task.id,
                avatarId,
                updated_at: 5000, // Stale write
            });

            expect(staleComplete.xpAwarded).toBe(0);
            expect(staleComplete.task.completed).toBe(false);
            expect(receivedEvents.length).toBe(0);

            // Verify task in store remains uncompleted
            const fetched = await client.call<Task>("task.get", { id: task.id });
            expect(fetched.completed).toBe(false);

            // Verify no XP on avatar
            const avatarState = await client.call<AvatarGetResult>("avatar.get", { avatarId });
            expect(avatarState.progression.totalXp).toBe(0);
        });
    });

    describe("Permission Enforcement Seam", () => {
        it("blocks write operations when caller only has tasks:read", async () => {
            const [hostTransport, clientTransport] = createMessageChannelTransportPair();
            bridge.connect(hostTransport, {
                callerId: "reader-only",
                permissions: ["tasks:read"],
            });
            const readerClient = new RpcClient(clientTransport);

            await expect(readerClient.call("task.create", { title: "Forbidden Task" })).rejects.toThrow(
                PermissionDeniedError,
            );

            await expect(readerClient.call("task.update", { id: "t-1", title: "Forbidden Update" })).rejects.toThrow(
                PermissionDeniedError,
            );

            await expect(readerClient.call("task.delete", { id: "t-1" })).rejects.toThrow(PermissionDeniedError);

            await expect(readerClient.call("task.schedule", { id: "t-1", timeBlockId: "tb-1" })).rejects.toThrow(
                PermissionDeniedError,
            );

            await expect(readerClient.call("task.complete", { id: "t-1" })).rejects.toThrow(PermissionDeniedError);

            readerClient.dispose();
        });

        it("blocks read operations when caller only has tasks:write", async () => {
            const [hostTransport, clientTransport] = createMessageChannelTransportPair();
            bridge.connect(hostTransport, {
                callerId: "writer-only",
                permissions: ["tasks:write"],
            });
            const writerClient = new RpcClient(clientTransport);

            await expect(writerClient.call("task.get", { id: "any" })).rejects.toThrow(PermissionDeniedError);

            await expect(writerClient.call("task.list")).rejects.toThrow(PermissionDeniedError);

            writerClient.dispose();
        });
    });

    describe("Lifecycle & Graceful Degradation Seam", () => {
        it("degrades gracefully when task plugin is disabled and restores upon re-enabling", async () => {
            expect(serviceRegistry.isAvailable("task")).toBe(true);

            // Disable task plugin
            await serviceRegistry.disablePlugin("@liferpg/plugin-core-task");
            expect(serviceRegistry.isAvailable("task")).toBe(false);

            await expect(client.call("task.list")).rejects.toBeInstanceOf(FeatureDisabledError);

            // Re-enable task plugin
            await serviceRegistry.enablePlugin("@liferpg/plugin-core-task");
            expect(serviceRegistry.isAvailable("task")).toBe(true);

            const list = await client.call<Task[]>("task.list");
            expect(Array.isArray(list)).toBe(true);
        });
    });
});
