import {
    type Routine,
    type TimeBlock,
    type CreateRoutineParams,
    type UpdateRoutineParams,
    type ListRoutinesParams,
    type DeleteRoutineParams,
    type CreateTimeBlockParams,
    type UpdateTimeBlockParams,
    type ListTimeBlocksParams,
    type DeleteTimeBlockParams,
    type DeleteEntityResult,
    validateCreateRoutineParams,
    validateUpdateRoutineParams,
    validateCreateTimeBlockParams,
    validateUpdateTimeBlockParams,
    shouldApplyLwwUpdate,
    generateId,
} from "@liferpg/sdk";

export class RoutineStoreError extends Error {
    public code: string;
    public data?: unknown;

    constructor(code: string, message: string, data?: unknown) {
        super(message);
        this.name = "RoutineStoreError";
        this.code = code;
        this.data = data;
    }
}

export class LocalRoutineStore {
    private routines = new Map<string, Routine>();
    private timeBlocks = new Map<string, TimeBlock>();
    private tombstones = new Map<string, number>();

    public createRoutine(params: CreateRoutineParams): Routine {
        const validation = validateCreateRoutineParams(params);
        if (!validation.valid) {
            throw new RoutineStoreError("VALIDATION_FAILED", validation.errors?.join("; ") || "Invalid params");
        }

        const now = Date.now();
        const id = params.id || generateId("routine");
        const created_at = params.created_at ?? now;
        const updated_at = params.updated_at ?? created_at;

        // If tombstone exists with later or equal timestamp, write is suppressed under LWW
        const tombstone = this.tombstones.get(id);
        if (tombstone !== undefined && !shouldApplyLwwUpdate(tombstone, updated_at)) {
            throw new RoutineStoreError("CONFLICT", `Routine '${id}' was deleted more recently.`);
        }

        const existing = this.routines.get(id);
        if (existing) {
            if (shouldApplyLwwUpdate(existing.updated_at, updated_at)) {
                existing.name = params.name;
                existing.description = params.description;
                existing.daysOfWeek = params.daysOfWeek;
                existing.updated_at = updated_at;
            }
            return this.getRoutine(id);
        }

        this.tombstones.delete(id);

        const routine: Routine = {
            id,
            name: params.name,
            description: params.description,
            daysOfWeek: params.daysOfWeek ? [...params.daysOfWeek] : undefined,
            timeBlocks: [],
            created_at,
            updated_at,
        };

        this.routines.set(id, routine);

        if (params.timeBlocks && params.timeBlocks.length > 0) {
            for (const tb of params.timeBlocks) {
                this.createTimeBlock({
                    ...tb,
                    routineId: id,
                });
            }
        }

        return this.getRoutine(id);
    }

    public getRoutine(id: string): Routine {
        if (this.tombstones.has(id)) {
            throw new RoutineStoreError("NOT_FOUND", `Routine '${id}' not found`);
        }
        const routine = this.routines.get(id);
        if (!routine) {
            throw new RoutineStoreError("NOT_FOUND", `Routine '${id}' not found`);
        }

        // Aggregate constituent time blocks
        const blocks = this.listTimeBlocks({ routineId: id });
        return {
            ...routine,
            timeBlocks: blocks,
        };
    }

    public listRoutines(params?: ListRoutinesParams): Routine[] {
        const results: Routine[] = [];
        for (const [id, r] of this.routines.entries()) {
            if (this.tombstones.has(id)) continue;

            if (params?.dayOfWeek !== undefined) {
                if (r.daysOfWeek && r.daysOfWeek.length > 0) {
                    if (!r.daysOfWeek.includes(params.dayOfWeek)) {
                        continue;
                    }
                }
            }

            results.push(this.getRoutine(id));
        }

        return results;
    }

    public updateRoutine(params: UpdateRoutineParams): Routine {
        const validation = validateUpdateRoutineParams(params);
        if (!validation.valid) {
            throw new RoutineStoreError("VALIDATION_FAILED", validation.errors?.join("; ") || "Invalid params");
        }

        if (this.tombstones.has(params.id)) {
            throw new RoutineStoreError("NOT_FOUND", `Routine '${params.id}' not found`);
        }

        const existing = this.routines.get(params.id);
        if (!existing) {
            throw new RoutineStoreError("NOT_FOUND", `Routine '${params.id}' not found`);
        }

        const incomingUpdatedAt = params.updated_at ?? Date.now();

        // Row-Level LWW conflict resolution:
        if (!shouldApplyLwwUpdate(existing.updated_at, incomingUpdatedAt)) {
            // Out of order stale write: ignore updates and return current latest record
            return this.getRoutine(params.id);
        }

        if (params.name !== undefined) {
            existing.name = params.name;
        }
        if (params.description !== undefined) {
            existing.description = params.description;
        }
        if (params.daysOfWeek !== undefined) {
            existing.daysOfWeek = [...params.daysOfWeek];
        }
        existing.updated_at = incomingUpdatedAt;

        return this.getRoutine(params.id);
    }

    public deleteRoutine(params: DeleteRoutineParams): DeleteEntityResult {
        const id = params.id;
        const routine = this.routines.get(id);
        if (!routine || this.tombstones.has(id)) {
            throw new RoutineStoreError("NOT_FOUND", `Routine '${id}' not found`);
        }

        const deleted_at = params.updated_at ?? Date.now();
        this.routines.delete(id);
        this.tombstones.set(id, deleted_at);

        // Cascade delete constituent Time Blocks
        for (const [tbId, tb] of this.timeBlocks.entries()) {
            if (tb.routineId === id) {
                this.timeBlocks.delete(tbId);
                this.tombstones.set(tbId, deleted_at);
            }
        }

        return {
            success: true,
            id,
            deleted_at,
        };
    }

    public createTimeBlock(params: CreateTimeBlockParams): TimeBlock {
        const validation = validateCreateTimeBlockParams(params);
        if (!validation.valid) {
            throw new RoutineStoreError("VALIDATION_FAILED", validation.errors?.join("; ") || "Invalid params");
        }

        // Verify parent routine exists
        const parentRoutine = this.routines.get(params.routineId);
        if (!parentRoutine || this.tombstones.has(params.routineId)) {
            throw new RoutineStoreError("NOT_FOUND", `Parent Routine '${params.routineId}' not found`);
        }

        const now = Date.now();
        const id = params.id || generateId("timeblock");
        const created_at = params.created_at ?? now;
        const updated_at = params.updated_at ?? created_at;

        const tombstone = this.tombstones.get(id);
        if (tombstone !== undefined && !shouldApplyLwwUpdate(tombstone, updated_at)) {
            throw new RoutineStoreError("CONFLICT", `TimeBlock '${id}' was deleted more recently.`);
        }

        const existing = this.timeBlocks.get(id);
        if (existing) {
            if (shouldApplyLwwUpdate(existing.updated_at, updated_at)) {
                existing.title = params.title;
                existing.description = params.description;
                existing.startTime = params.startTime;
                existing.endTime = params.endTime;
                existing.color = params.color;
                existing.updated_at = updated_at;
            }
            return { ...this.timeBlocks.get(id)! };
        }

        this.tombstones.delete(id);

        const timeBlock: TimeBlock = {
            id,
            routineId: params.routineId,
            title: params.title,
            description: params.description,
            startTime: params.startTime,
            endTime: params.endTime,
            color: params.color,
            created_at,
            updated_at,
        };

        this.timeBlocks.set(id, timeBlock);
        return { ...timeBlock };
    }

    public getTimeBlock(id: string): TimeBlock {
        if (this.tombstones.has(id)) {
            throw new RoutineStoreError("NOT_FOUND", `TimeBlock '${id}' not found`);
        }
        const tb = this.timeBlocks.get(id);
        if (!tb) {
            throw new RoutineStoreError("NOT_FOUND", `TimeBlock '${id}' not found`);
        }
        return { ...tb };
    }

    public listTimeBlocks(params?: ListTimeBlocksParams): TimeBlock[] {
        const results: TimeBlock[] = [];
        for (const [id, tb] of this.timeBlocks.entries()) {
            if (this.tombstones.has(id)) continue;
            if (params?.routineId && tb.routineId !== params.routineId) continue;
            results.push({ ...tb });
        }

        // Sort chronologically by startTime
        results.sort((a, b) => a.startTime.localeCompare(b.startTime));
        return results;
    }

    public updateTimeBlock(params: UpdateTimeBlockParams): TimeBlock {
        const validation = validateUpdateTimeBlockParams(params);
        if (!validation.valid) {
            throw new RoutineStoreError("VALIDATION_FAILED", validation.errors?.join("; ") || "Invalid params");
        }

        if (this.tombstones.has(params.id)) {
            throw new RoutineStoreError("NOT_FOUND", `TimeBlock '${params.id}' not found`);
        }

        const existing = this.timeBlocks.get(params.id);
        if (!existing) {
            throw new RoutineStoreError("NOT_FOUND", `TimeBlock '${params.id}' not found`);
        }

        const incomingUpdatedAt = params.updated_at ?? Date.now();

        // Row-Level LWW conflict resolution:
        if (!shouldApplyLwwUpdate(existing.updated_at, incomingUpdatedAt)) {
            return { ...existing };
        }

        if (params.title !== undefined) {
            existing.title = params.title;
        }
        if (params.description !== undefined) {
            existing.description = params.description;
        }
        if (params.startTime !== undefined) {
            existing.startTime = params.startTime;
        }
        if (params.endTime !== undefined) {
            existing.endTime = params.endTime;
        }
        if (params.color !== undefined) {
            existing.color = params.color;
        }
        existing.updated_at = incomingUpdatedAt;

        return { ...existing };
    }

    public deleteTimeBlock(params: DeleteTimeBlockParams): DeleteEntityResult {
        const id = params.id;
        const tb = this.timeBlocks.get(id);
        if (!tb || this.tombstones.has(id)) {
            throw new RoutineStoreError("NOT_FOUND", `TimeBlock '${id}' not found`);
        }

        const deleted_at = params.updated_at ?? Date.now();
        this.timeBlocks.delete(id);
        this.tombstones.set(id, deleted_at);

        return {
            success: true,
            id,
            deleted_at,
        };
    }

    public clear(): void {
        this.routines.clear();
        this.timeBlocks.clear();
        this.tombstones.clear();
    }
}
