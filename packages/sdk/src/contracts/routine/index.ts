import { defineEvent } from "../../types";
import type { Routine, TimeBlock } from "./types";

export * from "./types";
export * from "./schemas";

export const RoutineEvents = {
    Created: defineEvent<Routine>("routine:created"),
    Updated: defineEvent<Routine>("routine:updated"),
    Deleted: defineEvent<{ id: string; routine: Routine }>("routine:deleted"),
    TimeBlockCreated: defineEvent<TimeBlock>("routine:timeblock_created"),
    TimeBlockUpdated: defineEvent<TimeBlock>("routine:timeblock_updated"),
    TimeBlockDeleted: defineEvent<{ id: string; routineId: string; timeBlock: TimeBlock }>("routine:timeblock_deleted"),
} as const;

/**
 * Evaluates whether an incoming write should be applied under Row-Level Last-Write-Wins (LWW).
 * In ADR-0001, writes with an updated_at timestamp greater than or equal to existing updated_at win.
 */
export function shouldApplyLwwUpdate(existingUpdatedAt: number, incomingUpdatedAt: number): boolean {
    return incomingUpdatedAt >= existingUpdatedAt;
}
