import { defineEvent } from "../../types";
import type { CalendarDateOverride } from "./types";

export * from "./types";
export * from "./schemas";

export const CalendarEvents = {
    OverrideCreated: defineEvent<CalendarDateOverride>("calendar:override_created"),
    OverrideUpdated: defineEvent<CalendarDateOverride>("calendar:override_updated"),
    OverrideDeleted: defineEvent<{ id: string; override: CalendarDateOverride }>("calendar:override_deleted"),
} as const;
