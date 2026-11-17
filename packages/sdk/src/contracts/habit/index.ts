import { defineEvent } from "../../types";
import type {
    Habit,
    HabitCompletion,
    HabitCompletionEvent,
    HabitStreak,
    HabitHeatmapEntry,
    HabitHeatmapOptions,
} from "./types";

export * from "./types";
export * from "./schemas";

export const HabitEvents = {
    Created: defineEvent<Habit>("habit:created"),
    Updated: defineEvent<Habit>("habit:updated"),
    Deleted: defineEvent<{ id: string; habit: Habit }>("habit:deleted"),
    Completed: defineEvent<HabitCompletionEvent>("habit:completed"),
} as const;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function getDayNumber(timestamp: number): number {
    return Math.floor(timestamp / ONE_DAY_MS);
}

/**
 * Calculates current and longest streaks from an append-only log of habit completions.
 * Strictly positive reinforcement (streaks do not penalize or deduct XP).
 */
export function calculateHabitStreak(
    habitId: string,
    completions: HabitCompletion[],
    referenceTimestamp: number = Date.now(),
): HabitStreak {
    if (!completions || completions.length === 0) {
        return {
            habitId,
            currentStreak: 0,
            longestStreak: 0,
            totalCompletions: 0,
            lastCompletedAt: undefined,
        };
    }

    // Sort completions ascending by timestamp
    const sorted = [...completions].sort((a, b) => a.completedAt - b.completedAt);
    const lastCompletedAt = sorted[sorted.length - 1]?.completedAt;

    // Get sorted unique day numbers
    const uniqueDays = Array.from(new Set(sorted.map((c) => getDayNumber(c.completedAt)))).sort((a, b) => a - b);

    if (uniqueDays.length === 0) {
        return {
            habitId,
            currentStreak: 0,
            longestStreak: 0,
            totalCompletions: completions.length,
            lastCompletedAt,
        };
    }

    // Calculate longest consecutive streak in history
    let longestStreak = 1;
    let tempStreak = 1;
    for (let i = 1; i < uniqueDays.length; i++) {
        const prev = uniqueDays[i - 1]!;
        const curr = uniqueDays[i]!;
        if (curr === prev + 1) {
            tempStreak++;
            if (tempStreak > longestStreak) {
                longestStreak = tempStreak;
            }
        } else {
            tempStreak = 1;
        }
    }

    // Calculate current streak relative to referenceTimestamp
    const refDay = getDayNumber(referenceTimestamp);
    const lastDay = uniqueDays[uniqueDays.length - 1]!;

    let currentStreak = 0;
    // Current streak is active if completed today (refDay) or yesterday (refDay - 1)
    if (lastDay === refDay || lastDay === refDay - 1) {
        currentStreak = 1;
        for (let i = uniqueDays.length - 1; i > 0; i--) {
            const curr = uniqueDays[i]!;
            const prev = uniqueDays[i - 1]!;
            if (curr - prev === 1) {
                currentStreak++;
            } else {
                break;
            }
        }
    }

    return {
        habitId,
        currentStreak,
        longestStreak: Math.max(longestStreak, currentStreak),
        totalCompletions: completions.length,
        lastCompletedAt,
    };
}

function formatUtcDate(timestamp: number): string {
    const d = new Date(timestamp);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

/**
 * Aggregates an append-only log of HabitCompletions into daily heatmap entries.
 * Returns sorted entries by date ascending with counts, total XP awarded, and completion IDs.
 */
export function calculateHabitHeatmap(
    completions: HabitCompletion[],
    options?: HabitHeatmapOptions,
): HabitHeatmapEntry[] {
    const map = new Map<string, HabitHeatmapEntry>();

    for (const c of completions || []) {
        const date = formatUtcDate(c.completedAt);
        if (options?.startDate && date < options.startDate) {
            continue;
        }
        if (options?.endDate && date > options.endDate) {
            continue;
        }

        const existing = map.get(date);
        if (existing) {
            existing.count += 1;
            existing.totalXp += c.xpAwarded ?? 0;
            existing.completionIds.push(c.id);
        } else {
            map.set(date, {
                date,
                count: 1,
                totalXp: c.xpAwarded ?? 0,
                completionIds: [c.id],
            });
        }
    }

    if (options?.fillGaps && options.startDate && options.endDate) {
        const start = new Date(`${options.startDate}T00:00:00.000Z`).getTime();
        const end = new Date(`${options.endDate}T00:00:00.000Z`).getTime();
        for (let t = start; t <= end; t += ONE_DAY_MS) {
            const dateStr = formatUtcDate(t);
            if (!map.has(dateStr)) {
                map.set(dateStr, {
                    date: dateStr,
                    count: 0,
                    totalXp: 0,
                    completionIds: [],
                });
            }
        }
    }

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}
