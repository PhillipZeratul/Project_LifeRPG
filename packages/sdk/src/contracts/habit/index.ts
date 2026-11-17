import { defineEvent } from "../../types";
import type {
    Habit,
    HabitCompletion,
    HabitCompletionEvent,
    HabitStreak,
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
    referenceTimestamp: number = Date.now()
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
