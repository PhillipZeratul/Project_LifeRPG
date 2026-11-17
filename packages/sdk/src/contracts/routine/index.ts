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
 * Backward compatibility re-export. Canonical implementation moved to foundation/storage.
 */
export { shouldApplyLwwUpdate } from "../../foundation/storage";
