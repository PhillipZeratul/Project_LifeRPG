import { describe, it, expect } from "vitest";
import {
    validateCreateTaskParams,
    validateUpdateTaskParams,
    validateScheduleTaskParams,
    validateCompleteTaskParams,
    TaskEvents,
    type Task,
    type TaskSchedule,
} from "../index";

describe("Task Contracts & Validation Seam", () => {
    describe("Task Creation Validation", () => {
        it("accepts valid Task creation params", () => {
            const sampleTask: Partial<Task> = { id: "task-1", title: "Write documentation" };
            expect(sampleTask.title).toBe("Write documentation");
            const result = validateCreateTaskParams({
                title: "Write documentation",
                description: "Complete ADR-0001 documentation",
                statId: "intellect",
                xpReward: 35,
            });
            expect(result.valid).toBe(true);
            expect(result.errors).toBeUndefined();
        });

        it("accepts task scheduled in a single Time Block", () => {
            const result = validateCreateTaskParams({
                title: "Deep focus coding",
                timeBlockId: "tb-morning-focus",
            });
            expect(result.valid).toBe(true);
        });

        it("accepts task spanning multiple Time Blocks", () => {
            const result = validateCreateTaskParams({
                title: "Large refactor",
                timeBlockIds: ["tb-block-1", "tb-block-2"],
            });
            expect(result.valid).toBe(true);
        });

        it("accepts standalone task scheduled on Calendar with date and time", () => {
            const result = validateCreateTaskParams({
                title: "Dentist appointment",
                dueDate: "2026-11-17",
                dueTime: "14:30",
            });
            expect(result.valid).toBe(true);
        });

        it("accepts standalone task with TaskSchedule object", () => {
            const schedule: TaskSchedule = {
                date: "2026-11-18",
                time: "09:00",
                timeBlockIds: ["tb-1"],
                estimatedDurationMinutes: 60,
            };
            const result = validateCreateTaskParams({
                title: "Architecture sync",
                schedule,
            });
            expect(result.valid).toBe(true);
        });

        it("rejects missing or empty title", () => {
            const emptyResult = validateCreateTaskParams({ title: "" });
            expect(emptyResult.valid).toBe(false);
            expect(emptyResult.errors?.[0]).toContain("title");

            const missingResult = validateCreateTaskParams({});
            expect(missingResult.valid).toBe(false);
        });

        it("rejects negative xpReward", () => {
            const result = validateCreateTaskParams({
                title: "Fix bug",
                xpReward: -10,
            });
            expect(result.valid).toBe(false);
            expect(result.errors?.[0]).toContain("xpReward");
        });

        it("rejects non-object params", () => {
            expect(validateCreateTaskParams(null).valid).toBe(false);
            expect(validateCreateTaskParams("string").valid).toBe(false);
        });
    });

    describe("Task Update Validation", () => {
        it("accepts valid update params", () => {
            const result = validateUpdateTaskParams({
                id: "task-1",
                title: "Updated Title",
                completed: true,
            });
            expect(result.valid).toBe(true);
        });

        it("requires id for update", () => {
            const result = validateUpdateTaskParams({ title: "Updated Title" });
            expect(result.valid).toBe(false);
            expect(result.errors?.[0]).toContain("id");
        });

        it("accepts schedule changes on update", () => {
            const result = validateUpdateTaskParams({
                id: "task-1",
                timeBlockId: null, // unanchor
                dueDate: "2026-11-20",
            });
            expect(result.valid).toBe(true);
        });
    });

    describe("Task Scheduling Validation", () => {
        it("accepts valid schedule params", () => {
            const result = validateScheduleTaskParams({
                id: "task-1",
                timeBlockId: "tb-10",
                dueDate: "2026-11-17",
                dueTime: "10:00",
            });
            expect(result.valid).toBe(true);
        });

        it("rejects schedule params missing id", () => {
            const result = validateScheduleTaskParams({
                timeBlockId: "tb-10",
            });
            expect(result.valid).toBe(false);
            expect(result.errors?.[0]).toContain("id");
        });
    });

    describe("Task Completion Validation", () => {
        it("accepts valid complete params", () => {
            const result = validateCompleteTaskParams({
                id: "task-1",
                avatarId: "avatar-agent-1",
                notes: "Finished early",
            });
            expect(result.valid).toBe(true);
        });

        it("rejects complete params missing id", () => {
            const result = validateCompleteTaskParams({});
            expect(result.valid).toBe(false);
            expect(result.errors?.[0]).toContain("id");
        });
    });

    describe("Task Event Definitions", () => {
        it("defines expected event names for Task lifecycle and progression", () => {
            expect(TaskEvents.Created.type).toBe("task:created");
            expect(TaskEvents.Updated.type).toBe("task:updated");
            expect(TaskEvents.Deleted.type).toBe("task:deleted");
            expect(TaskEvents.Completed.type).toBe("task:completed");
            expect(TaskEvents.Scheduled.type).toBe("task:scheduled");
        });
    });
});
