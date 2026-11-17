import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    RpcClient,
    PermissionDeniedError,
    FeatureDisabledError,
    createMessageChannelTransportPair,
    HabitEvents,
    type Habit,
    type HabitCompletion,
    type TrackHabitResult,
    type HabitDeleteResult,
    type AvatarGetResult,
} from "@liferpg/sdk";
import HabitPlugin from "@liferpg/plugin-core-habit";
import {
    HostRpcBridge,
    CentralEventBus,
    CentralServiceRegistry,
    AvatarService,
    InMemoryProgressionStore,
    registerAvatarRpcHandlers,
    wireHabitProgressionIntegration,
} from "../index";

describe("Habit Core Plugin Seam (Host RPC Bridge & Avatar Progression)", () => {
    let bridge: HostRpcBridge;
    let eventBus: CentralEventBus;
    let serviceRegistry: CentralServiceRegistry;
    let progressionStore: InMemoryProgressionStore;
    let avatarService: AvatarService;
    let client: RpcClient;
    let cleanup: () => void;
    let unhookProgression: () => void;

    beforeEach(async () => {
        HabitPlugin.resetDefaultStore();
        bridge = new HostRpcBridge();
        eventBus = new CentralEventBus();
        progressionStore = new InMemoryProgressionStore();
        avatarService = new AvatarService(progressionStore);

        // Register avatar handlers and wire habit completion events to progression engine
        registerAvatarRpcHandlers(bridge, avatarService);
        unhookProgression = wireHabitProgressionIntegration(eventBus, avatarService);

        serviceRegistry = new CentralServiceRegistry(bridge, eventBus);

        // Enable Habit plugin
        await serviceRegistry.enablePlugin("@liferpg/plugin-core-habit");

        // Client with full permissions
        const [hostTransport, clientTransport] = createMessageChannelTransportPair();
        const disconnect = bridge.connect(hostTransport, {
            callerId: "test-client",
            permissions: ["habits:read", "habits:track", "habits:write"],
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

    describe("Habit CRUD Operations (LWW Synchronization)", () => {
        it("creates and retrieves a standalone Habit", async () => {
            const created = await client.call<Habit>("habit.create", {
                name: "Morning Meditation",
                description: "15 minutes mindfulness",
                statId: "focus",
                xpReward: 25,
            });

            expect(created.id).toBeDefined();
            expect(created.name).toBe("Morning Meditation");
            expect(created.description).toBe("15 minutes mindfulness");
            expect(created.statId).toBe("focus");
            expect(created.xpReward).toBe(25);
            expect(created.timeBlockId).toBeUndefined();
            expect(created.created_at).toBeGreaterThan(0);
            expect(created.updated_at).toBe(created.created_at);

            const fetched = await client.call<Habit>("habit.get", { id: created.id });
            expect(fetched).toEqual(created);
        });

        it("creates a Habit anchored to a Time Block and lists by timeBlockId", async () => {
            const timeBlockId = "tb-deep-work-block";
            const anchored = await client.call<Habit>("habit.create", {
                name: "Deep Code Review",
                timeBlockId,
                statId: "intellect",
                xpReward: 30,
            });

            const standalone = await client.call<Habit>("habit.create", {
                name: "Hydration",
                xpReward: 5,
            });

            expect(anchored.timeBlockId).toBe(timeBlockId);
            expect(standalone.timeBlockId).toBeUndefined();

            // List all habits
            const all = await client.call<Habit[]>("habit.list");
            expect(all.length).toBe(2);

            // Filter by timeBlockId
            const filtered = await client.call<Habit[]>("habit.list", { timeBlockId });
            expect(filtered.length).toBe(1);
            expect(filtered[0]!.id).toBe(anchored.id);
            expect(filtered[0]!.name).toBe("Deep Code Review");
        });

        it("updates habit details with updated_at timestamp progression under LWW", async () => {
            const created = await client.call<Habit>("habit.create", {
                name: "Exercise",
                xpReward: 20,
            });

            const updated = await client.call<Habit>("habit.update", {
                id: created.id,
                name: "Intense Calisthenics",
                xpReward: 35,
                statId: "vitality",
                updated_at: created.updated_at + 1000,
            });

            expect(updated.name).toBe("Intense Calisthenics");
            expect(updated.xpReward).toBe(35);
            expect(updated.statId).toBe("vitality");
            expect(updated.updated_at).toBe(created.updated_at + 1000);

            // Stale update with older updated_at timestamp should be ignored (ADR-0001 LWW)
            const stale = await client.call<Habit>("habit.update", {
                id: created.id,
                name: "Stale Name",
                updated_at: created.updated_at - 500,
            });
            expect(stale.name).toBe("Intense Calisthenics");
        });

        it("deletes a habit and prevents retrieval", async () => {
            const created = await client.call<Habit>("habit.create", {
                name: "Temporary Habit",
            });

            const deleteResult = await client.call<HabitDeleteResult>("habit.delete", {
                id: created.id,
            });
            expect(deleteResult.success).toBe(true);
            expect(deleteResult.id).toBe(created.id);

            await expect(client.call("habit.get", { id: created.id })).rejects.toThrow(/not found/i);
        });
    });

    describe("Append-Only Completion Logging & Tracking", () => {
        it("records completions in an append-only log preventing overwrites", async () => {
            const habit = await client.call<Habit>("habit.create", {
                name: "Read 20 pages",
                statId: "intellect",
                xpReward: 20,
            });

            const avatarId = "avatar-reader";

            // Track completion 1
            const track1 = await client.call<TrackHabitResult>("habit.track", {
                habitId: habit.id,
                avatarId,
                notes: "Chapter 1 completed",
            });

            expect(track1.completion.id).toBeDefined();
            expect(track1.completion.habitId).toBe(habit.id);
            expect(track1.completion.avatarId).toBe(avatarId);
            expect(track1.completion.xpAwarded).toBe(20);
            expect(track1.streak.totalCompletions).toBe(1);
            expect(track1.streak.currentStreak).toBe(1);

            // Track completion 2
            const track2 = await client.call<TrackHabitResult>("habit.track", {
                habitId: habit.id,
                avatarId,
                notes: "Chapter 2 completed",
            });

            expect(track2.completion.id).not.toBe(track1.completion.id);
            expect(track2.streak.totalCompletions).toBe(2);

            // Query completions list
            const completions = await client.call<HabitCompletion[]>("habit.getCompletions", {
                habitId: habit.id,
            });
            expect(completions.length).toBe(2);
            expect(completions[0]!.id).toBe(track1.completion.id);
            expect(completions[1]!.id).toBe(track2.completion.id);
        });

        it("supports alias habit.complete for habit.track", async () => {
            const habit = await client.call<Habit>("habit.create", {
                name: "Hydration",
                xpReward: 10,
            });

            const result = await client.call<TrackHabitResult>("habit.complete", {
                habitId: habit.id,
            });
            expect(result.completion).toBeDefined();
            expect(result.xpAwarded).toBe(10);
        });

        it("supports merging multi-device append-only completion logs without data loss", async () => {
            const habit = await client.call<Habit>("habit.create", {
                name: "Language Practice",
            });

            // Record completions with explicit notes and timestamps
            await client.call<TrackHabitResult>("habit.track", {
                habitId: habit.id,
                completedAt: Date.now() - 3600000,
                notes: "Device A sync",
            });
            await client.call<TrackHabitResult>("habit.track", {
                habitId: habit.id,
                completedAt: Date.now(),
                notes: "Device B sync",
            });

            const allCompletions = await client.call<HabitCompletion[]>("habit.getCompletions", {
                habitId: habit.id,
            });
            expect(allCompletions.length).toBe(2);
            expect(allCompletions.map((c) => c.notes)).toEqual(["Device A sync", "Device B sync"]);
        });
    });

    describe("Event Emission & Avatar Progression Engine Integration", () => {
        it("emits habit:completed event and triggers additive XP on Avatar progression engine", async () => {
            const avatarId = "avatar-test-7";
            const habit = await client.call<Habit>("habit.create", {
                name: "Morning Coding",
                statId: "focus",
                xpReward: 50,
            });

            // Track completion
            await client.call<TrackHabitResult>("habit.track", {
                habitId: habit.id,
                avatarId,
            });

            // Query avatar progression directly via avatar.get
            const avatarState = await client.call<AvatarGetResult>("avatar.get", {
                avatarId,
            });

            expect(avatarState.progression.totalXp).toBe(50);
            expect(avatarState.progression.level).toBe(1);
            expect(avatarState.progression.stats["focus"]).toBeDefined();
            expect(avatarState.progression.stats["focus"]!.currentXp).toBe(50);
            expect(avatarState.progression.stats["focus"]!.totalXp).toBe(50);

            // Complete habit again -> additive XP increases without reset
            await client.call<TrackHabitResult>("habit.track", {
                habitId: habit.id,
                avatarId,
            });

            const updatedAvatarState = await client.call<AvatarGetResult>("avatar.get", {
                avatarId,
            });
            expect(updatedAvatarState.progression.totalXp).toBe(100);
            expect(updatedAvatarState.progression.level).toBe(2);
            expect(updatedAvatarState.progression.stats["focus"]!.totalXp).toBe(100);
        });

        it("emits events to external CentralEventBus listeners", async () => {
            const receivedEvents: unknown[] = [];
            eventBus.on(HabitEvents.Completed, (evt) => {
                receivedEvents.push(evt);
            });

            const habit = await client.call<Habit>("habit.create", {
                name: "Journaling",
                xpReward: 15,
            });

            await client.call("habit.track", {
                habitId: habit.id,
                avatarId: "avatar-listener",
            });

            expect(receivedEvents.length).toBe(1);
            const first = receivedEvents[0] as { habit: Habit; xpAwarded: number };
            expect(first.habit.id).toBe(habit.id);
            expect(first.xpAwarded).toBe(15);
        });
    });

    describe("Permission Enforcement Seam", () => {
        it("blocks write operations when caller only has habits:read", async () => {
            const [hostTransport, clientTransport] = createMessageChannelTransportPair();
            bridge.connect(hostTransport, {
                callerId: "reader-only",
                permissions: ["habits:read"],
            });
            const readerClient = new RpcClient(clientTransport);

            await expect(
                readerClient.call("habit.create", { name: "Should Fail" })
            ).rejects.toThrow(PermissionDeniedError);

            await expect(
                readerClient.call("habit.update", { id: "h-1", name: "Should Fail" })
            ).rejects.toThrow(PermissionDeniedError);

            await expect(
                readerClient.call("habit.delete", { id: "h-1" })
            ).rejects.toThrow(PermissionDeniedError);

            readerClient.dispose();
        });

        it("blocks tracking operations when caller lacks habits:track", async () => {
            const [hostTransport, clientTransport] = createMessageChannelTransportPair();
            bridge.connect(hostTransport, {
                callerId: "no-track",
                permissions: ["habits:read", "habits:write"],
            });
            const noTrackClient = new RpcClient(clientTransport);

            const habit = await noTrackClient.call<Habit>("habit.create", {
                name: "Track Test",
            });

            await expect(
                noTrackClient.call("habit.track", { habitId: habit.id })
            ).rejects.toThrow(PermissionDeniedError);

            await expect(
                noTrackClient.call("habit.complete", { habitId: habit.id })
            ).rejects.toThrow(PermissionDeniedError);

            noTrackClient.dispose();
        });

        it("blocks read operations when caller lacks habits:read", async () => {
            const [hostTransport, clientTransport] = createMessageChannelTransportPair();
            bridge.connect(hostTransport, {
                callerId: "tracker-only",
                permissions: ["habits:track"],
            });
            const trackerClient = new RpcClient(clientTransport);

            await expect(trackerClient.call("habit.get", { id: "any" })).rejects.toThrow(
                PermissionDeniedError
            );
            await expect(trackerClient.call("habit.list")).rejects.toThrow(
                PermissionDeniedError
            );
            await expect(trackerClient.call("habit.getCompletions", { habitId: "any" })).rejects.toThrow(
                PermissionDeniedError
            );

            trackerClient.dispose();
        });
    });

    describe("Lifecycle & Graceful Degradation Seam", () => {
        it("degrades gracefully when habit plugin is disabled and restores upon re-enabling", async () => {
            expect(serviceRegistry.isAvailable("habit")).toBe(true);

            // Disable habit plugin
            await serviceRegistry.disablePlugin("@liferpg/plugin-core-habit");
            expect(serviceRegistry.isAvailable("habit")).toBe(false);

            await expect(client.call("habit.list")).rejects.toBeInstanceOf(FeatureDisabledError);

            // Re-enable habit plugin
            await serviceRegistry.enablePlugin("@liferpg/plugin-core-habit");
            expect(serviceRegistry.isAvailable("habit")).toBe(true);

            const list = await client.call<Habit[]>("habit.list");
            expect(Array.isArray(list)).toBe(true);
        });
    });
});
