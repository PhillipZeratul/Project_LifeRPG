import {
    type Routine,
    type CalendarTimeBlock,
    type CalendarDayTimeline,
    type CalendarTimelineRange,
    type CalendarDateOverride,
    type CreateCalendarOverrideParams,
    type UpdateCalendarOverrideParams,
    type GetDayTimelineParams,
    type GetTimelineRangeParams,
    type ListCalendarOverridesParams,
    type DeleteCalendarOverrideParams,
    type DeleteEntityResult,
    validateCreateCalendarOverrideParams,
    validateUpdateCalendarOverrideParams,
    validateGetDayTimelineParams,
    validateGetTimelineRangeParams,
    shouldApplyLwwUpdate,
    generateId,
} from "@liferpg/sdk";

export class CalendarStoreError extends Error {
    public code: string;
    public data?: unknown;

    constructor(code: string, message: string, data?: unknown) {
        super(message);
        this.name = "CalendarStoreError";
        this.code = code;
        this.data = data;
    }
}

export function getDayOfWeekFromDate(date: string): number {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0)).getUTCDay();
}

export function getNextDateString(date: string): string {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(Date.UTC(y!, m! - 1, d! + 1, 12, 0, 0)).toISOString().split("T")[0]!;
}

export function calculateBlockTimings(date: string, startTime: string, endTime: string) {
    const [sH, sM] = startTime.split(":").map(Number);
    const [eH, eM] = endTime.split(":").map(Number);

    const [year, month, day] = date.split("-").map(Number);

    const startDateObj = new Date(Date.UTC(year!, month! - 1, day!, sH!, sM!, 0, 0));

    let endDateObj = new Date(Date.UTC(year!, month! - 1, day!, eH!, eM!, 0, 0));
    // If endTime is before or equal to startTime, it crosses midnight into the next day
    if (endDateObj.getTime() <= startDateObj.getTime()) {
        endDateObj = new Date(endDateObj.getTime() + 24 * 60 * 60 * 1000);
    }

    const startTimestamp = startDateObj.getTime();
    const endTimestamp = endDateObj.getTime();
    const durationMinutes = Math.round((endTimestamp - startTimestamp) / 60000);

    return {
        startDateTime: startDateObj.toISOString(),
        endDateTime: endDateObj.toISOString(),
        startTimestamp,
        endTimestamp,
        durationMinutes,
    };
}

export class LocalCalendarStore {
    private overrides = new Map<string, CalendarDateOverride>();
    private tombstones = new Map<string, number>();

    public createOverride(params: CreateCalendarOverrideParams): CalendarDateOverride {
        const validation = validateCreateCalendarOverrideParams(params);
        if (!validation.valid) {
            throw new CalendarStoreError("VALIDATION_FAILED", validation.errors?.join("; ") || "Invalid params");
        }

        const now = Date.now();
        const id =
            params.id || (params.timeBlockId ? `ovr_${params.date}_${params.timeBlockId}` : generateId("override"));
        const created_at = params.created_at ?? now;
        const updated_at = params.updated_at ?? created_at;

        // Row-Level Last-Write-Wins check against tombstones
        const tombstone = this.tombstones.get(id);
        if (tombstone !== undefined && !shouldApplyLwwUpdate(tombstone, updated_at)) {
            throw new CalendarStoreError("CONFLICT", `Calendar override '${id}' was deleted more recently.`);
        }

        const existing = this.overrides.get(id);
        if (existing) {
            if (shouldApplyLwwUpdate(existing.updated_at, updated_at)) {
                if (params.title !== undefined) existing.title = params.title;
                if (params.description !== undefined) existing.description = params.description;
                if (params.startTime !== undefined) existing.startTime = params.startTime;
                if (params.endTime !== undefined) existing.endTime = params.endTime;
                if (params.color !== undefined) existing.color = params.color;
                if (params.isCancelled !== undefined) existing.isCancelled = params.isCancelled;
                existing.updated_at = updated_at;
            }
            return { ...existing };
        }

        this.tombstones.delete(id);

        const override: CalendarDateOverride = {
            id,
            date: params.date,
            timeBlockId: params.timeBlockId,
            routineId: params.routineId,
            title: params.title,
            description: params.description,
            startTime: params.startTime,
            endTime: params.endTime,
            color: params.color,
            isCancelled: params.isCancelled,
            created_at,
            updated_at,
        };

        this.overrides.set(id, override);
        return { ...override };
    }

    public getOverride(id: string): CalendarDateOverride {
        if (this.tombstones.has(id)) {
            throw new CalendarStoreError("NOT_FOUND", `Calendar override '${id}' not found`);
        }
        const override = this.overrides.get(id);
        if (!override) {
            throw new CalendarStoreError("NOT_FOUND", `Calendar override '${id}' not found`);
        }
        return { ...override };
    }

    public listOverrides(params?: ListCalendarOverridesParams): CalendarDateOverride[] {
        const results: CalendarDateOverride[] = [];
        for (const [id, ovr] of this.overrides.entries()) {
            if (this.tombstones.has(id)) continue;

            if (params?.date && ovr.date !== params.date) continue;
            if (params?.startDate && ovr.date < params.startDate) continue;
            if (params?.endDate && ovr.date > params.endDate) continue;
            if (params?.routineId && ovr.routineId !== params.routineId) continue;
            if (params?.timeBlockId && ovr.timeBlockId !== params.timeBlockId) continue;

            results.push({ ...ovr });
        }
        return results;
    }

    public updateOverride(params: UpdateCalendarOverrideParams): CalendarDateOverride {
        const validation = validateUpdateCalendarOverrideParams(params);
        if (!validation.valid) {
            throw new CalendarStoreError("VALIDATION_FAILED", validation.errors?.join("; ") || "Invalid params");
        }

        if (this.tombstones.has(params.id)) {
            throw new CalendarStoreError("NOT_FOUND", `Calendar override '${params.id}' not found`);
        }

        const existing = this.overrides.get(params.id);
        if (!existing) {
            throw new CalendarStoreError("NOT_FOUND", `Calendar override '${params.id}' not found`);
        }

        const incomingUpdatedAt = params.updated_at ?? Date.now();

        // Row-Level LWW conflict resolution
        if (!shouldApplyLwwUpdate(existing.updated_at, incomingUpdatedAt)) {
            // Out of order stale write: ignore updates and return current latest record
            return { ...existing };
        }

        if (params.title !== undefined) existing.title = params.title;
        if (params.description !== undefined) existing.description = params.description;
        if (params.startTime !== undefined) existing.startTime = params.startTime;
        if (params.endTime !== undefined) existing.endTime = params.endTime;
        if (params.color !== undefined) existing.color = params.color;
        if (params.isCancelled !== undefined) existing.isCancelled = params.isCancelled;
        existing.updated_at = incomingUpdatedAt;

        return { ...existing };
    }

    public deleteOverride(params: DeleteCalendarOverrideParams): DeleteEntityResult {
        const id = params.id;
        const incomingUpdatedAt = params.updated_at ?? Date.now();

        const tombstone = this.tombstones.get(id);
        if (tombstone !== undefined && !shouldApplyLwwUpdate(tombstone, incomingUpdatedAt)) {
            return {
                success: true,
                id,
                deleted_at: tombstone,
            };
        }

        const existing = this.overrides.get(id);
        if (existing) {
            if (!shouldApplyLwwUpdate(existing.updated_at, incomingUpdatedAt)) {
                throw new CalendarStoreError("CONFLICT", `Stale delete for override '${id}'`);
            }
            this.overrides.delete(id);
        }

        this.tombstones.set(id, incomingUpdatedAt);

        return {
            success: true,
            id,
            deleted_at: incomingUpdatedAt,
        };
    }

    public getDayTimeline(params: GetDayTimelineParams, routines: Routine[] = []): CalendarDayTimeline {
        const validation = validateGetDayTimelineParams(params);
        if (!validation.valid) {
            throw new CalendarStoreError("VALIDATION_FAILED", validation.errors?.join("; ") || "Invalid params");
        }

        const date = params.date;
        const dayOfWeek = getDayOfWeekFromDate(date);

        // Filter routines applicable to this dayOfWeek
        const activeRoutines: Array<{ id: string; name: string }> = [];
        const matchingRoutines: Routine[] = [];

        for (const routine of routines) {
            if (!routine.daysOfWeek || routine.daysOfWeek.length === 0 || routine.daysOfWeek.includes(dayOfWeek)) {
                matchingRoutines.push(routine);
                activeRoutines.push({ id: routine.id, name: routine.name });
            }
        }

        // Gather overrides for this date
        const dateOverrides = this.listOverrides({ date });
        const overrideByTimeBlockId = new Map<string, CalendarDateOverride>();
        const standaloneOverrides: CalendarDateOverride[] = [];

        for (const ovr of dateOverrides) {
            if (ovr.timeBlockId) {
                overrideByTimeBlockId.set(ovr.timeBlockId, ovr);
            } else {
                standaloneOverrides.push(ovr);
            }
        }

        const blocks: CalendarTimeBlock[] = [];

        // Project time blocks from matching routines
        for (const routine of matchingRoutines) {
            for (const tb of routine.timeBlocks || []) {
                const override = overrideByTimeBlockId.get(tb.id);

                if (override?.isCancelled) {
                    // Suppressed on this date
                    continue;
                }

                const title = override?.title ?? tb.title;
                const description = override?.description ?? tb.description;
                const startTime = override?.startTime ?? tb.startTime;
                const endTime = override?.endTime ?? tb.endTime;
                const color = override?.color ?? tb.color;
                const isOverride = Boolean(override);

                const timings = calculateBlockTimings(date, startTime, endTime);

                blocks.push({
                    id: override ? override.id : `${date}_${tb.id}`,
                    date,
                    timeBlockId: tb.id,
                    routineId: routine.id,
                    routineName: routine.name,
                    title,
                    description,
                    startTime,
                    endTime,
                    startDateTime: timings.startDateTime,
                    endDateTime: timings.endDateTime,
                    startTimestamp: timings.startTimestamp,
                    endTimestamp: timings.endTimestamp,
                    durationMinutes: timings.durationMinutes,
                    color,
                    isOverride,
                    overrideId: override?.id,
                });
            }
        }

        // Project standalone overrides for this date
        for (const ovr of standaloneOverrides) {
            if (ovr.isCancelled) continue;
            if (!ovr.title || !ovr.startTime || !ovr.endTime) continue;

            const timings = calculateBlockTimings(date, ovr.startTime, ovr.endTime);

            blocks.push({
                id: ovr.id,
                date,
                title: ovr.title,
                description: ovr.description,
                startTime: ovr.startTime,
                endTime: ovr.endTime,
                startDateTime: timings.startDateTime,
                endDateTime: timings.endDateTime,
                startTimestamp: timings.startTimestamp,
                endTimestamp: timings.endTimestamp,
                durationMinutes: timings.durationMinutes,
                color: ovr.color,
                isOverride: true,
                overrideId: ovr.id,
            });
        }

        // Chronological sort
        blocks.sort((a, b) => a.startTimestamp - b.startTimestamp || a.endTimestamp - b.endTimestamp);

        return {
            date,
            dayOfWeek,
            routines: activeRoutines,
            blocks,
        };
    }

    public async getTimelineRange(
        params: GetTimelineRangeParams,
        routineProvider?: (dayOfWeek?: number) => Promise<Routine[]> | Routine[],
    ): Promise<CalendarTimelineRange> {
        const validation = validateGetTimelineRangeParams(params);
        if (!validation.valid) {
            throw new CalendarStoreError("VALIDATION_FAILED", validation.errors?.join("; ") || "Invalid params");
        }

        const days: CalendarDayTimeline[] = [];
        let currentDate = params.startDate;

        while (currentDate <= params.endDate) {
            const dayOfWeek = getDayOfWeekFromDate(currentDate);
            const routines = routineProvider ? await routineProvider(dayOfWeek) : [];
            days.push(this.getDayTimeline({ date: currentDate }, routines));
            currentDate = getNextDateString(currentDate);
        }

        return {
            startDate: params.startDate,
            endDate: params.endDate,
            days,
        };
    }
}
