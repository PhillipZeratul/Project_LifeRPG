import type { DeleteEntityResult } from "../routine";

export interface CalendarTimeBlock {
    id: string;
    date: string; // "YYYY-MM-DD"
    timeBlockId?: string;
    routineId?: string;
    routineName?: string;
    title: string;
    description?: string;
    startTime: string; // "HH:MM"
    endTime: string; // "HH:MM"
    startDateTime: string; // ISO 8601 string, e.g. "2026-11-17T09:00:00.000Z"
    endDateTime: string; // ISO 8601 string, e.g. "2026-11-17T10:30:00.000Z"
    startTimestamp: number; // epoch ms
    endTimestamp: number; // epoch ms
    durationMinutes: number;
    color?: string;
    isOverride: boolean;
    overrideId?: string;
}

export interface CalendarDayTimeline {
    date: string; // "YYYY-MM-DD"
    dayOfWeek: number; // 0..6 (0 = Sunday, 1 = Monday, ...)
    routines: Array<{ id: string; name: string }>;
    blocks: CalendarTimeBlock[];
}

export interface CalendarTimelineRange {
    startDate: string;
    endDate: string;
    days: CalendarDayTimeline[];
}

export interface CalendarDateOverride {
    id: string;
    date: string; // "YYYY-MM-DD"
    timeBlockId?: string;
    routineId?: string;
    title?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    color?: string;
    isCancelled?: boolean;
    created_at: number;
    updated_at: number;
}

export interface CreateCalendarOverrideParams {
    id?: string;
    date: string;
    timeBlockId?: string;
    routineId?: string;
    title?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    color?: string;
    isCancelled?: boolean;
    created_at?: number;
    updated_at?: number;
}

export interface UpdateCalendarOverrideParams {
    id: string;
    title?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    color?: string;
    isCancelled?: boolean;
    updated_at?: number;
}

export interface GetCalendarOverrideParams {
    id: string;
}

export interface ListCalendarOverridesParams {
    date?: string;
    startDate?: string;
    endDate?: string;
    routineId?: string;
    timeBlockId?: string;
}

export interface DeleteCalendarOverrideParams {
    id: string;
    updated_at?: number;
}

export interface GetDayTimelineParams {
    date: string; // "YYYY-MM-DD"
}

export interface GetTimelineRangeParams {
    startDate: string; // "YYYY-MM-DD"
    endDate: string; // "YYYY-MM-DD"
}

export interface CalendarServiceContract {
    getDayTimeline(params: GetDayTimelineParams): Promise<CalendarDayTimeline>;
    getTimelineRange(params: GetTimelineRangeParams): Promise<CalendarTimelineRange>;
    createOverride(params: CreateCalendarOverrideParams): Promise<CalendarDateOverride>;
    getOverride(params: GetCalendarOverrideParams): Promise<CalendarDateOverride>;
    listOverrides(params?: ListCalendarOverridesParams): Promise<CalendarDateOverride[]>;
    updateOverride(params: UpdateCalendarOverrideParams): Promise<CalendarDateOverride>;
    deleteOverride(params: DeleteCalendarOverrideParams): Promise<DeleteEntityResult>;
}
