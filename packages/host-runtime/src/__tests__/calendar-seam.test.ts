import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    RpcClient,
    PermissionDeniedError,
    FeatureDisabledError,
    createMessageChannelTransportPair,
    CalendarEvents,
    type Routine,
    type CalendarDayTimeline,
    type CalendarTimelineRange,
    type CalendarDateOverride,
    type DeleteEntityResult,
} from "@liferpg/sdk";
import RoutinePlugin from "@liferpg/plugin-core-routine";
import CalendarPlugin from "@liferpg/plugin-core-calendar";
import {
    HostRpcBridge,
    CentralEventBus,
    CentralServiceRegistry,
} from "../index";

describe("Calendar Temporal Canvas Service Seam (Host RPC Bridge)", () => {
    let bridge: HostRpcBridge;
    let eventBus: CentralEventBus;
    let serviceRegistry: CentralServiceRegistry;
    let cleanup: () => void;
    let client: RpcClient;

    beforeEach(async () => {
        RoutinePlugin.resetDefaultStore();
        CalendarPlugin.resetDefaultStore();

        bridge = new HostRpcBridge();
        eventBus = new CentralEventBus();
        serviceRegistry = new CentralServiceRegistry(bridge, eventBus);

        // Enable both routine and calendar core plugins
        await serviceRegistry.enablePlugin("@liferpg/plugin-core-routine");
        await serviceRegistry.enablePlugin("@liferpg/plugin-core-calendar");

        // Client with full permissions
        const [hostTransport, clientTransport] = createMessageChannelTransportPair();
        const disconnect = bridge.connect(hostTransport, {
            callerId: "test-client",
            permissions: [
                "calendar:read",
                "calendar:write",
                "routines:read",
                "routines:write",
            ],
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

    describe("Daily Routine Projection onto Calendar Timeline", () => {
        it("projects recurring routines and time blocks onto a specific date with accurate timings", async () => {
            // Setup: Create a weekday routine (Mon-Fri: [1, 2, 3, 4, 5])
            const routine = await client.call<Routine>("routine.create", {
                name: "Productivity Blueprint",
                description: "Core workday flow",
                daysOfWeek: [1, 2, 3, 4, 5],
            });

            await client.call("routine.createTimeBlock", {
                routineId: routine.id,
                title: "Deep Work Flow",
                startTime: "09:00",
                endTime: "10:30",
                color: "#4A90E2",
            });

            await client.call("routine.createTimeBlock", {
                routineId: routine.id,
                title: "Afternoon Sync",
                startTime: "14:00",
                endTime: "15:00",
                color: "#50E3C2",
            });

            // 2026-11-17 is a Tuesday (dayOfWeek = 2)
            const timeline = await client.call<CalendarDayTimeline>("calendar.getDayTimeline", {
                date: "2026-11-17",
            });

            expect(timeline.date).toBe("2026-11-17");
            expect(timeline.dayOfWeek).toBe(2);
            expect(timeline.routines).toHaveLength(1);
            expect(timeline.routines[0]!.id).toBe(routine.id);
            expect(timeline.routines[0]!.name).toBe("Productivity Blueprint");

            expect(timeline.blocks).toHaveLength(2);

            const [block1, block2] = timeline.blocks;
            expect(block1!.title).toBe("Deep Work Flow");
            expect(block1!.startTime).toBe("09:00");
            expect(block1!.endTime).toBe("10:30");
            expect(block1!.startDateTime).toBe("2026-11-17T09:00:00.000Z");
            expect(block1!.endDateTime).toBe("2026-11-17T10:30:00.000Z");
            expect(block1!.durationMinutes).toBe(90);
            expect(block1!.endTimestamp - block1!.startTimestamp).toBe(90 * 60 * 1000);
            expect(block1!.isOverride).toBe(false);
            expect(block1!.routineId).toBe(routine.id);
            expect(block1!.color).toBe("#4A90E2");

            expect(block2!.title).toBe("Afternoon Sync");
            expect(block2!.startTime).toBe("14:00");
            expect(block2!.endTime).toBe("15:00");
            expect(block2!.durationMinutes).toBe(60);
        });

        it("does not project weekday routines on non-matching days (e.g. Sunday)", async () => {
            await client.call<Routine>("routine.create", {
                name: "Workday Routine",
                daysOfWeek: [1, 2, 3, 4, 5],
            });

            // 2026-11-15 is Sunday (dayOfWeek = 0)
            const timeline = await client.call<CalendarDayTimeline>("calendar.getDayTimeline", {
                date: "2026-11-15",
            });

            expect(timeline.date).toBe("2026-11-15");
            expect(timeline.dayOfWeek).toBe(0);
            expect(timeline.routines).toHaveLength(0);
            expect(timeline.blocks).toHaveLength(0);
        });
    });

    describe("Date Range Projection on Temporal Canvas", () => {
        it("projects routines across date ranges with accurate day timelines", async () => {
            const routine = await client.call<Routine>("routine.create", {
                name: "Workday Flow",
                daysOfWeek: [1, 2, 3, 4, 5],
            });

            await client.call("routine.createTimeBlock", {
                routineId: routine.id,
                title: "Morning Flow",
                startTime: "08:30",
                endTime: "09:30",
            });

            // Range: 2026-11-19 (Thu, day 4) to 2026-11-22 (Sun, day 0)
            const range = await client.call<CalendarTimelineRange>("calendar.getTimelineRange", {
                startDate: "2026-11-19",
                endDate: "2026-11-22",
            });

            expect(range.startDate).toBe("2026-11-19");
            expect(range.endDate).toBe("2026-11-22");
            expect(range.days).toHaveLength(4);

            const [thu, fri, sat, sun] = range.days;

            // Thursday (day 4)
            expect(thu!.date).toBe("2026-11-19");
            expect(thu!.dayOfWeek).toBe(4);
            expect(thu!.blocks).toHaveLength(1);
            expect(thu!.blocks[0]!.title).toBe("Morning Flow");
            expect(thu!.blocks[0]!.startDateTime).toBe("2026-11-19T08:30:00.000Z");

            // Friday (day 5)
            expect(fri!.date).toBe("2026-11-20");
            expect(fri!.dayOfWeek).toBe(5);
            expect(fri!.blocks).toHaveLength(1);
            expect(fri!.blocks[0]!.startDateTime).toBe("2026-11-20T08:30:00.000Z");

            // Saturday (day 6) - non-matching
            expect(sat!.date).toBe("2026-11-21");
            expect(sat!.dayOfWeek).toBe(6);
            expect(sat!.blocks).toHaveLength(0);

            // Sunday (day 0) - non-matching
            expect(sun!.date).toBe("2026-11-22");
            expect(sun!.dayOfWeek).toBe(0);
            expect(sun!.blocks).toHaveLength(0);
        });
    });

    describe("Date-Specific Overrides with Row-Level LWW (ADR-0001)", () => {
        it("applies a date-specific override to a routine time block without affecting other days", async () => {
            const routine = await client.call<Routine>("routine.create", {
                name: "Standard Routine",
                daysOfWeek: [1, 2, 3, 4, 5],
            });

            const block = await client.call<{ id: string }>("routine.createTimeBlock", {
                routineId: routine.id,
                title: "Deep Work",
                startTime: "09:00",
                endTime: "10:30",
            });

            // On 2026-11-17 (Tue), reschedule to 10:00 - 11:30 and rename
            const override = await client.call<CalendarDateOverride>("calendar.createOverride", {
                date: "2026-11-17",
                timeBlockId: block.id,
                routineId: routine.id,
                title: "Rescheduled Strategy Session",
                startTime: "10:00",
                endTime: "11:30",
                color: "#FF5733",
            });

            expect(override.id).toBeDefined();
            expect(override.date).toBe("2026-11-17");
            expect(override.timeBlockId).toBe(block.id);
            expect(override.title).toBe("Rescheduled Strategy Session");

            // Check 2026-11-17 timeline
            const overriddenDay = await client.call<CalendarDayTimeline>("calendar.getDayTimeline", {
                date: "2026-11-17",
            });
            expect(overriddenDay.blocks).toHaveLength(1);
            expect(overriddenDay.blocks[0]!.title).toBe("Rescheduled Strategy Session");
            expect(overriddenDay.blocks[0]!.startTime).toBe("10:00");
            expect(overriddenDay.blocks[0]!.endTime).toBe("11:30");
            expect(overriddenDay.blocks[0]!.isOverride).toBe(true);
            expect(overriddenDay.blocks[0]!.overrideId).toBe(override.id);
            expect(overriddenDay.blocks[0]!.color).toBe("#FF5733");

            // Check 2026-11-18 (Wed) timeline: must retain original routine definition
            const normalDay = await client.call<CalendarDayTimeline>("calendar.getDayTimeline", {
                date: "2026-11-18",
            });
            expect(normalDay.blocks).toHaveLength(1);
            expect(normalDay.blocks[0]!.title).toBe("Deep Work");
            expect(normalDay.blocks[0]!.startTime).toBe("09:00");
            expect(normalDay.blocks[0]!.endTime).toBe("10:30");
            expect(normalDay.blocks[0]!.isOverride).toBe(false);
        });

        it("suppresses a routine time block when isCancelled override is set", async () => {
            const routine = await client.call<Routine>("routine.create", {
                name: "Everyday Rhythm",
                daysOfWeek: [1, 2, 3, 4, 5],
            });

            const block = await client.call<{ id: string }>("routine.createTimeBlock", {
                routineId: routine.id,
                title: "Daily Standup",
                startTime: "09:30",
                endTime: "10:00",
            });

            // Cancel Daily Standup on 2026-11-17
            await client.call("calendar.createOverride", {
                date: "2026-11-17",
                timeBlockId: block.id,
                routineId: routine.id,
                isCancelled: true,
            });

            const dayWithCancel = await client.call<CalendarDayTimeline>("calendar.getDayTimeline", {
                date: "2026-11-17",
            });
            expect(dayWithCancel.blocks).toHaveLength(0);

            // Other day still has it
            const dayWithoutCancel = await client.call<CalendarDayTimeline>("calendar.getDayTimeline", {
                date: "2026-11-18",
            });
            expect(dayWithoutCancel.blocks).toHaveLength(1);
            expect(dayWithoutCancel.blocks[0]!.title).toBe("Daily Standup");
        });

        it("projects standalone date-specific time blocks alongside routine blocks", async () => {
            const routine = await client.call<Routine>("routine.create", {
                name: "Work Routine",
                daysOfWeek: [1, 2, 3, 4, 5],
            });

            await client.call("routine.createTimeBlock", {
                routineId: routine.id,
                title: "Morning Routine",
                startTime: "09:00",
                endTime: "10:00",
            });

            // Standalone event on 2026-11-17 (e.g. Doctor appointment at 11:00)
            await client.call("calendar.createOverride", {
                date: "2026-11-17",
                title: "Dentist Visit",
                startTime: "11:00",
                endTime: "12:00",
                color: "#E91E63",
            });

            const timeline = await client.call<CalendarDayTimeline>("calendar.getDayTimeline", {
                date: "2026-11-17",
            });

            expect(timeline.blocks).toHaveLength(2);
            expect(timeline.blocks[0]!.title).toBe("Morning Routine");
            expect(timeline.blocks[0]!.isOverride).toBe(false);

            expect(timeline.blocks[1]!.title).toBe("Dentist Visit");
            expect(timeline.blocks[1]!.isOverride).toBe(true);
            expect(timeline.blocks[1]!.startTime).toBe("11:00");
            expect(timeline.blocks[1]!.color).toBe("#E91E63");
        });

        it("resolves Row-Level Last-Write-Wins conflicts correctly", async () => {
            const initial = await client.call<CalendarDateOverride>("calendar.createOverride", {
                id: "test-lww-override",
                date: "2026-11-17",
                title: "First Version",
                startTime: "10:00",
                endTime: "11:00",
                created_at: 1000,
                updated_at: 1000,
            });

            expect(initial.title).toBe("First Version");

            // Newer update wins (updated_at = 2000)
            const updated = await client.call<CalendarDateOverride>("calendar.updateOverride", {
                id: "test-lww-override",
                title: "Second Version",
                updated_at: 2000,
            });
            expect(updated.title).toBe("Second Version");
            expect(updated.updated_at).toBe(2000);

            // Stale update (updated_at = 1500 < 2000) must be ignored under LWW
            const staleResult = await client.call<CalendarDateOverride>("calendar.updateOverride", {
                id: "test-lww-override",
                title: "Stale Version",
                updated_at: 1500,
            });
            expect(staleResult.title).toBe("Second Version");
            expect(staleResult.updated_at).toBe(2000);

            // Verification query
            const verified = await client.call<CalendarDateOverride>("calendar.getOverride", {
                id: "test-lww-override",
            });
            expect(verified.title).toBe("Second Version");
        });

        it("deletes overrides and prevents resurrection by stale writes via tombstones", async () => {
            await client.call<CalendarDateOverride>("calendar.createOverride", {
                id: "ovr-to-delete",
                date: "2026-11-17",
                title: "Temporary Block",
                startTime: "12:00",
                endTime: "13:00",
                created_at: 1000,
                updated_at: 1000,
            });

            // Delete with timestamp 2000
            const delRes = await client.call<DeleteEntityResult>("calendar.deleteOverride", {
                id: "ovr-to-delete",
                updated_at: 2000,
            });
            expect(delRes.success).toBe(true);
            expect(delRes.id).toBe("ovr-to-delete");

            // Stale creation attempt with timestamp 1500 should be rejected by tombstone
            await expect(
                client.call("calendar.createOverride", {
                    id: "ovr-to-delete",
                    date: "2026-11-17",
                    title: "Resurrected Block",
                    startTime: "12:00",
                    endTime: "13:00",
                    updated_at: 1500,
                })
            ).rejects.toThrow();

            // Direct fetch confirms not found
            await expect(
                client.call("calendar.getOverride", { id: "ovr-to-delete" })
            ).rejects.toThrow();
        });
    });

    describe("Permission Enforcement Seam", () => {
        it("blocks write operations when caller only has calendar:read", async () => {
            const [readHostTransport, readClientTransport] = createMessageChannelTransportPair();
            const disconnectRead = bridge.connect(readHostTransport, {
                callerId: "read-only-client",
                permissions: ["calendar:read"],
            });
            const readOnlyClient = new RpcClient(readClientTransport);

            try {
                // Read operations should succeed
                const timeline = await readOnlyClient.call<CalendarDayTimeline>("calendar.getDayTimeline", {
                    date: "2026-11-17",
                });
                expect(timeline).toBeDefined();

                // Write operation should be blocked
                await expect(
                    readOnlyClient.call("calendar.createOverride", {
                        date: "2026-11-17",
                        title: "Unauthorized Event",
                        startTime: "10:00",
                        endTime: "11:00",
                    })
                ).rejects.toBeInstanceOf(PermissionDeniedError);
            } finally {
                readOnlyClient.dispose();
                disconnectRead();
            }
        });

        it("blocks read operations when caller lacks calendar:read", async () => {
            const [unauthHostTransport, unauthClientTransport] = createMessageChannelTransportPair();
            const disconnectUnauth = bridge.connect(unauthHostTransport, {
                callerId: "unauthorized-client",
                permissions: ["routines:read"],
            });
            const unauthClient = new RpcClient(unauthClientTransport);

            try {
                await expect(
                    unauthClient.call("calendar.getDayTimeline", { date: "2026-11-17" })
                ).rejects.toBeInstanceOf(PermissionDeniedError);

                await expect(
                    unauthClient.call("calendar.getTimelineRange", {
                        startDate: "2026-11-17",
                        endDate: "2026-11-18",
                    })
                ).rejects.toBeInstanceOf(PermissionDeniedError);
            } finally {
                unauthClient.dispose();
                disconnectUnauth();
            }
        });
    });

    describe("Lifecycle & Graceful Degradation Seam", () => {
        it("degrades gracefully when calendar plugin is disabled and restores upon re-enabling", async () => {
            expect(await client.isAvailable("calendar.getDayTimeline")).toBe(true);

            // Disable calendar plugin
            await serviceRegistry.disablePlugin("@liferpg/plugin-core-calendar");

            expect(await client.isAvailable("calendar.getDayTimeline")).toBe(false);
            await expect(
                client.call("calendar.getDayTimeline", { date: "2026-11-17" })
            ).rejects.toBeInstanceOf(FeatureDisabledError);

            // Re-enable calendar plugin
            await serviceRegistry.enablePlugin("@liferpg/plugin-core-calendar");

            expect(await client.isAvailable("calendar.getDayTimeline")).toBe(true);
            const timeline = await client.call<CalendarDayTimeline>("calendar.getDayTimeline", {
                date: "2026-11-17",
            });
            expect(timeline).toBeDefined();
        });

        it("gracefully returns empty routine blueprints when routine plugin is disabled", async () => {
            // Disable routine plugin while calendar plugin is enabled
            await serviceRegistry.disablePlugin("@liferpg/plugin-core-routine");

            const timeline = await client.call<CalendarDayTimeline>("calendar.getDayTimeline", {
                date: "2026-11-17",
            });

            expect(timeline.date).toBe("2026-11-17");
            expect(timeline.routines).toEqual([]);
            expect(timeline.blocks).toEqual([]);
        });
    });

    describe("Event Emission & Observability Seam", () => {
        it("emits lifecycle events on CentralEventBus when overrides are created, updated, and deleted", async () => {
            const createdEvents: CalendarDateOverride[] = [];
            const updatedEvents: CalendarDateOverride[] = [];
            const deletedEvents: Array<{ id: string; override: CalendarDateOverride }> = [];

            eventBus.on(CalendarEvents.OverrideCreated, (payload) => {
                createdEvents.push(payload);
            });
            eventBus.on(CalendarEvents.OverrideUpdated, (payload) => {
                updatedEvents.push(payload);
            });
            eventBus.on(CalendarEvents.OverrideDeleted, (payload) => {
                deletedEvents.push(payload);
            });

            // Create override
            const created = await client.call<CalendarDateOverride>("calendar.createOverride", {
                date: "2026-11-17",
                title: "Event One",
                startTime: "13:00",
                endTime: "14:00",
            });

            expect(createdEvents).toHaveLength(1);
            expect(createdEvents[0]!.id).toBe(created.id);

            // Update override
            const updated = await client.call<CalendarDateOverride>("calendar.updateOverride", {
                id: created.id,
                title: "Updated Event One",
            });
            expect(updated.title).toBe("Updated Event One");

            expect(updatedEvents).toHaveLength(1);
            expect(updatedEvents[0]!.title).toBe("Updated Event One");

            // Delete override
            await client.call("calendar.deleteOverride", { id: created.id });

            expect(deletedEvents).toHaveLength(1);
            expect(deletedEvents[0]!.id).toBe(created.id);
            expect(deletedEvents[0]!.override.title).toBe("Updated Event One");
        });
    });

    describe("Edge Cases & Schema Validation Handling", () => {
        it("handles overnight blocks crossing midnight with accurate timestamps and duration", async () => {
            const routine = await client.call<Routine>("routine.create", {
                name: "Night Owl Flow",
                daysOfWeek: [2],
            });

            await client.call("routine.createTimeBlock", {
                routineId: routine.id,
                title: "Late Night Coding",
                startTime: "23:00",
                endTime: "01:30",
            });

            // 2026-11-17 is Tuesday (dayOfWeek = 2)
            const timeline = await client.call<CalendarDayTimeline>("calendar.getDayTimeline", {
                date: "2026-11-17",
            });

            expect(timeline.blocks).toHaveLength(1);
            const block = timeline.blocks[0]!;
            expect(block.startDateTime).toBe("2026-11-17T23:00:00.000Z");
            expect(block.endDateTime).toBe("2026-11-18T01:30:00.000Z");
            expect(block.durationMinutes).toBe(150); // 2.5 hours
            expect(block.endTimestamp - block.startTimestamp).toBe(150 * 60 * 1000);
        });

        it("filters overrides by list query parameters", async () => {
            await client.call("calendar.createOverride", {
                date: "2026-11-17",
                title: "Override 1",
                startTime: "09:00",
                endTime: "10:00",
                routineId: "routine-x",
            });

            await client.call("calendar.createOverride", {
                date: "2026-11-18",
                title: "Override 2",
                startTime: "10:00",
                endTime: "11:00",
                routineId: "routine-y",
            });

            // Filter by date
            const dateList = await client.call<CalendarDateOverride[]>("calendar.listOverrides", {
                date: "2026-11-17",
            });
            expect(dateList).toHaveLength(1);
            expect(dateList[0]!.title).toBe("Override 1");

            // Filter by routineId
            const routineList = await client.call<CalendarDateOverride[]>("calendar.listOverrides", {
                routineId: "routine-y",
            });
            expect(routineList).toHaveLength(1);
            expect(routineList[0]!.title).toBe("Override 2");
        });

        it("rejects invalid date query format with validation error", async () => {
            await expect(
                client.call("calendar.getDayTimeline", { date: "17-11-2026" })
            ).rejects.toThrow();

            await expect(
                client.call("calendar.getTimelineRange", {
                    startDate: "2026-11-20",
                    endDate: "2026-11-10",
                })
            ).rejects.toThrow();
        });
    });
});
