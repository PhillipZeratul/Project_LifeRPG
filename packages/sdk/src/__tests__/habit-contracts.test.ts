import { describe, it, expect } from "vitest";
import {
    validateCreateHabitParams,
    validateUpdateHabitParams,
    validateTrackHabitParams,
    calculateHabitStreak,
    calculateHabitHeatmap,
    HabitEvents,
    type HabitCompletion,
} from "../contracts/habit";

describe("Habit Contracts & Schema Validation", () => {
    describe("validateCreateHabitParams", () => {
        it("validates valid standalone habit params", () => {
            const valid = validateCreateHabitParams({
                name: "Morning Meditation",
                description: "10 minutes mindfulness practice",
                statId: "focus",
                xpReward: 20,
            });
            expect(valid.valid).toBe(true);
            expect(valid.errors).toBeUndefined();
        });

        it("validates habit anchored to a time block", () => {
            const valid = validateCreateHabitParams({
                name: "Focus Journaling",
                timeBlockId: "tb-morning-deep-work",
                statId: "intellect",
                xpReward: 15,
            });
            expect(valid.valid).toBe(true);
        });

        it("rejects missing or empty name", () => {
            const result = validateCreateHabitParams({
                name: "   ",
            });
            expect(result.valid).toBe(false);
            expect(result.errors).toContain("Habit 'name' is required and must be a non-empty string.");
        });

        it("rejects negative xpReward", () => {
            const result = validateCreateHabitParams({
                name: "Workout",
                xpReward: -5,
            });
            expect(result.valid).toBe(false);
            expect(result.errors).toContain("Habit 'xpReward' must be a non-negative number if provided.");
        });

        it("rejects invalid daysOfWeek", () => {
            const result = validateCreateHabitParams({
                name: "Reading",
                daysOfWeek: [1, 7],
            });
            expect(result.valid).toBe(false);
            expect(result.errors).toBeDefined();
        });
    });

    describe("validateUpdateHabitParams", () => {
        it("validates valid update params", () => {
            const valid = validateUpdateHabitParams({
                id: "habit-1",
                name: "Updated Habit Name",
                timeBlockId: "tb-new-anchor",
            });
            expect(valid.valid).toBe(true);
        });

        it("allows unanchoring from a time block by setting timeBlockId to null", () => {
            const valid = validateUpdateHabitParams({
                id: "habit-1",
                timeBlockId: null,
            });
            expect(valid.valid).toBe(true);
        });

        it("rejects missing habit id", () => {
            const result = validateUpdateHabitParams({
                name: "No ID",
            });
            expect(result.valid).toBe(false);
            expect(result.errors).toContain("Habit 'id' is required for update.");
        });
    });

    describe("validateTrackHabitParams", () => {
        it("validates valid track/completion params", () => {
            const valid = validateTrackHabitParams({
                habitId: "habit-1",
                avatarId: "avatar-default",
                notes: "Felt very focused today",
            });
            expect(valid.valid).toBe(true);
        });

        it("rejects missing habitId", () => {
            const result = validateTrackHabitParams({});
            expect(result.valid).toBe(false);
            expect(result.errors).toContain("Habit 'habitId' is required for tracking.");
        });
    });

    describe("calculateHabitStreak", () => {
        it("returns zero streak for empty completions", () => {
            const streak = calculateHabitStreak("habit-1", []);
            expect(streak).toEqual({
                habitId: "habit-1",
                currentStreak: 0,
                longestStreak: 0,
                totalCompletions: 0,
                lastCompletedAt: undefined,
            });
        });

        it("calculates positive streak across consecutive days", () => {
            const dayMs = 24 * 60 * 60 * 1000;
            // Let reference "now" be anchor Day 3 at 12:00
            const day1 = 1700000000000; // e.g. Day 1
            const day2 = day1 + dayMs;   // Day 2
            const day3 = day2 + dayMs;   // Day 3

            const completions: HabitCompletion[] = [
                {
                    id: "c1",
                    habitId: "habit-1",
                    avatarId: "avatar-1",
                    completedAt: day1,
                    xpAwarded: 10,
                },
                {
                    id: "c2",
                    habitId: "habit-1",
                    avatarId: "avatar-1",
                    completedAt: day2,
                    xpAwarded: 10,
                },
                {
                    id: "c3",
                    habitId: "habit-1",
                    avatarId: "avatar-1",
                    completedAt: day3,
                    xpAwarded: 10,
                },
            ];

            const streak = calculateHabitStreak("habit-1", completions, day3);
            expect(streak.totalCompletions).toBe(3);
            expect(streak.currentStreak).toBe(3);
            expect(streak.longestStreak).toBe(3);
            expect(streak.lastCompletedAt).toBe(day3);
        });

        it("handles multiple completions on the same day without inflating streak", () => {
            const dayMs = 24 * 60 * 60 * 1000;
            const day1Morning = 1700000000000;
            const day1Evening = day1Morning + 4 * 60 * 60 * 1000;
            const day2 = day1Morning + dayMs;

            const completions: HabitCompletion[] = [
                { id: "c1", habitId: "habit-1", avatarId: "avatar-1", completedAt: day1Morning, xpAwarded: 10 },
                { id: "c2", habitId: "habit-1", avatarId: "avatar-1", completedAt: day1Evening, xpAwarded: 10 },
                { id: "c3", habitId: "habit-1", avatarId: "avatar-1", completedAt: day2, xpAwarded: 10 },
            ];

            const streak = calculateHabitStreak("habit-1", completions, day2);
            expect(streak.totalCompletions).toBe(3);
            expect(streak.currentStreak).toBe(2);
            expect(streak.longestStreak).toBe(2);
        });
    });

    describe("calculateHabitHeatmap", () => {
        it("aggregates multiple completions into daily heatmap entries with count and total XP", () => {
            const completions: HabitCompletion[] = [
                {
                    id: "c1",
                    habitId: "habit-1",
                    avatarId: "avatar-1",
                    completedAt: new Date("2026-11-15T08:00:00.000Z").getTime(),
                    xpAwarded: 20,
                },
                {
                    id: "c2",
                    habitId: "habit-1",
                    avatarId: "avatar-1",
                    completedAt: new Date("2026-11-15T18:00:00.000Z").getTime(),
                    xpAwarded: 20,
                },
                {
                    id: "c3",
                    habitId: "habit-1",
                    avatarId: "avatar-1",
                    completedAt: new Date("2026-11-16T09:00:00.000Z").getTime(),
                    xpAwarded: 15,
                },
            ];

            const heatmap = calculateHabitHeatmap(completions);
            expect(heatmap).toEqual([
                {
                    date: "2026-11-15",
                    count: 2,
                    totalXp: 40,
                    completionIds: ["c1", "c2"],
                },
                {
                    date: "2026-11-16",
                    count: 1,
                    totalXp: 15,
                    completionIds: ["c3"],
                },
            ]);
        });

        it("handles empty completions gracefully", () => {
            const heatmap = calculateHabitHeatmap([]);
            expect(heatmap).toEqual([]);
        });

        it("supports date range filtering and filling gaps with zero counts", () => {
            const completions: HabitCompletion[] = [
                {
                    id: "c1",
                    habitId: "habit-1",
                    avatarId: "avatar-1",
                    completedAt: new Date("2026-11-15T10:00:00.000Z").getTime(),
                    xpAwarded: 10,
                },
            ];

            const heatmap = calculateHabitHeatmap(completions, {
                startDate: "2026-11-14",
                endDate: "2026-11-16",
                fillGaps: true,
            });

            expect(heatmap).toEqual([
                {
                    date: "2026-11-14",
                    count: 0,
                    totalXp: 0,
                    completionIds: [],
                },
                {
                    date: "2026-11-15",
                    count: 1,
                    totalXp: 10,
                    completionIds: ["c1"],
                },
                {
                    date: "2026-11-16",
                    count: 0,
                    totalXp: 0,
                    completionIds: [],
                },
            ]);
        });
    });

    describe("HabitEvents definitions", () => {
        it("defines correct event keys", () => {
            expect(HabitEvents.Created).toBe("habit:created");
            expect(HabitEvents.Updated).toBe("habit:updated");
            expect(HabitEvents.Deleted).toBe("habit:deleted");
            expect(HabitEvents.Completed).toBe("habit:completed");
        });
    });
});
