import {
    type Task,
    type CreateTaskParams,
    type UpdateTaskParams,
    type ScheduleTaskParams,
    type CompleteTaskParams,
    type ListTasksParams,
    type DeleteTaskParams,
    type TaskDeleteResult,
    type CompleteTaskResult,
    validateCreateTaskParams,
    validateUpdateTaskParams,
    validateScheduleTaskParams,
    validateCompleteTaskParams,
    shouldApplyLwwUpdate,
    generateId,
} from "@liferpg/sdk";

export class TaskStoreError extends Error {
    public code: string;
    public data?: unknown;

    constructor(code: string, message: string, data?: unknown) {
        super(message);
        this.name = "TaskStoreError";
        this.code = code;
        this.data = data;
    }
}

export class LocalTaskStore {
    private tasks = new Map<string, Task>();
    private tombstones = new Map<string, number>();

    public createTask(params: CreateTaskParams): Task {
        const validation = validateCreateTaskParams(params);
        if (!validation.valid) {
            throw new TaskStoreError("VALIDATION_FAILED", validation.errors?.join("; ") || "Invalid params");
        }

        const now = Date.now();
        const id = params.id || generateId("task");
        const created_at = params.created_at ?? now;
        const updated_at = params.updated_at ?? created_at;

        // If tombstone exists with later timestamp, write is suppressed under LWW
        const tombstone = this.tombstones.get(id);
        if (tombstone !== undefined && !shouldApplyLwwUpdate(tombstone, updated_at)) {
            throw new TaskStoreError("CONFLICT", `Task '${id}' was deleted more recently.`);
        }

        const existing = this.tasks.get(id);
        if (existing) {
            if (shouldApplyLwwUpdate(existing.updated_at, updated_at)) {
                existing.title = params.title;
                existing.description = params.description;
                existing.statId = params.statId;
                existing.xpReward = params.xpReward;
                existing.timeBlockId = params.timeBlockId;
                existing.timeBlockIds = params.timeBlockIds ? [...params.timeBlockIds] : undefined;
                existing.dueDate = params.dueDate;
                existing.dueTime = params.dueTime;
                existing.schedule = params.schedule ? { ...params.schedule } : undefined;
                existing.completed = params.completed ?? existing.completed;
                existing.updated_at = updated_at;
            }
            return { ...this.tasks.get(id)! };
        }

        this.tombstones.delete(id);

        const task: Task = {
            id,
            title: params.title,
            description: params.description,
            completed: params.completed ?? false,
            statId: params.statId,
            xpReward: params.xpReward ?? 10,
            timeBlockId: params.timeBlockId,
            timeBlockIds: params.timeBlockIds ? [...params.timeBlockIds] : undefined,
            dueDate: params.dueDate,
            dueTime: params.dueTime,
            schedule: params.schedule ? { ...params.schedule } : undefined,
            archived: false,
            created_at,
            updated_at,
        };

        this.tasks.set(id, task);
        return { ...task };
    }

    public getTask(id: string): Task {
        const task = this.tasks.get(id);
        if (!task) {
            throw new TaskStoreError("NOT_FOUND", `Task with id '${id}' not found.`);
        }
        return { ...task };
    }

    public listTasks(params?: ListTasksParams): Task[] {
        let results = Array.from(this.tasks.values());

        if (params) {
            if (params.timeBlockId !== undefined) {
                results = results.filter(
                    (t) => t.timeBlockId === params.timeBlockId || t.timeBlockIds?.includes(params.timeBlockId!),
                );
            }
            if (params.completed !== undefined) {
                results = results.filter((t) => t.completed === params.completed);
            }
            if (params.statId !== undefined) {
                results = results.filter((t) => t.statId === params.statId);
            }
            if (params.dueDate !== undefined) {
                results = results.filter((t) => t.dueDate === params.dueDate);
            }
            if (params.archived !== undefined) {
                results = results.filter((t) => (t.archived ?? false) === params.archived);
            }
        }

        return results.map((t) => ({ ...t }));
    }

    public updateTask(params: UpdateTaskParams): Task {
        const validation = validateUpdateTaskParams(params);
        if (!validation.valid) {
            throw new TaskStoreError("VALIDATION_FAILED", validation.errors?.join("; ") || "Invalid params");
        }

        const existing = this.tasks.get(params.id);
        if (!existing) {
            throw new TaskStoreError("NOT_FOUND", `Task with id '${params.id}' not found.`);
        }

        const incomingUpdatedAt = params.updated_at ?? Date.now();
        if (!shouldApplyLwwUpdate(existing.updated_at, incomingUpdatedAt)) {
            // LWW suppression: incoming write is stale, return unmodified state
            return { ...existing };
        }

        if (params.title !== undefined) existing.title = params.title;
        if (params.description !== undefined) existing.description = params.description;
        if (params.completed !== undefined) existing.completed = params.completed;
        if (params.completedAt !== undefined) existing.completedAt = params.completedAt;
        if (params.statId !== undefined) existing.statId = params.statId;
        if (params.xpReward !== undefined) existing.xpReward = params.xpReward;
        if (params.timeBlockId !== undefined) existing.timeBlockId = params.timeBlockId;
        if (params.timeBlockIds !== undefined) {
            existing.timeBlockIds = params.timeBlockIds === null ? undefined : [...params.timeBlockIds];
        }
        if (params.dueDate !== undefined) existing.dueDate = params.dueDate === null ? undefined : params.dueDate;
        if (params.dueTime !== undefined) existing.dueTime = params.dueTime === null ? undefined : params.dueTime;
        if (params.schedule !== undefined) {
            existing.schedule = params.schedule === null ? undefined : { ...params.schedule };
        }
        if (params.archived !== undefined) existing.archived = params.archived;

        existing.updated_at = incomingUpdatedAt;

        return { ...existing };
    }

    public deleteTask(params: DeleteTaskParams): TaskDeleteResult {
        const existing = this.tasks.get(params.id);
        if (!existing) {
            throw new TaskStoreError("NOT_FOUND", `Task with id '${params.id}' not found.`);
        }

        const incomingUpdatedAt = params.updated_at ?? Date.now();
        const tombstone = this.tombstones.get(params.id);
        if (tombstone !== undefined && !shouldApplyLwwUpdate(tombstone, incomingUpdatedAt)) {
            throw new TaskStoreError("CONFLICT", `Task '${params.id}' was deleted more recently.`);
        }

        this.tombstones.set(params.id, incomingUpdatedAt);
        this.tasks.delete(params.id);

        return {
            success: true,
            id: params.id,
            deleted_at: incomingUpdatedAt,
        };
    }

    public scheduleTask(params: ScheduleTaskParams): Task {
        const validation = validateScheduleTaskParams(params);
        if (!validation.valid) {
            throw new TaskStoreError("VALIDATION_FAILED", validation.errors?.join("; ") || "Invalid params");
        }

        const existing = this.tasks.get(params.id);
        if (!existing) {
            throw new TaskStoreError("NOT_FOUND", `Task with id '${params.id}' not found.`);
        }

        const incomingUpdatedAt = params.updated_at ?? Date.now();
        if (!shouldApplyLwwUpdate(existing.updated_at, incomingUpdatedAt)) {
            return { ...existing };
        }

        if (params.timeBlockId !== undefined) {
            existing.timeBlockId = params.timeBlockId;
        }
        if (params.timeBlockIds !== undefined) {
            existing.timeBlockIds = params.timeBlockIds === null ? undefined : [...params.timeBlockIds];
        }
        if (params.dueDate !== undefined) {
            existing.dueDate = params.dueDate === null ? undefined : params.dueDate;
        }
        if (params.dueTime !== undefined) {
            existing.dueTime = params.dueTime === null ? undefined : params.dueTime;
        }
        if (params.schedule !== undefined) {
            existing.schedule = params.schedule === null ? undefined : { ...params.schedule };
        }

        existing.updated_at = incomingUpdatedAt;

        return { ...existing };
    }

    public completeTask(params: CompleteTaskParams): CompleteTaskResult {
        const validation = validateCompleteTaskParams(params);
        if (!validation.valid) {
            throw new TaskStoreError("VALIDATION_FAILED", validation.errors?.join("; ") || "Invalid params");
        }

        const existing = this.tasks.get(params.id);
        if (!existing) {
            throw new TaskStoreError("NOT_FOUND", `Task with id '${params.id}' not found.`);
        }

        const now = Date.now();
        const incomingUpdatedAt = params.updated_at ?? now;
        const completedAt = params.completedAt ?? now;

        const isStale = !shouldApplyLwwUpdate(existing.updated_at, incomingUpdatedAt);
        const alreadyCompleted = Boolean(existing.completed);

        if (isStale || alreadyCompleted) {
            return {
                task: { ...existing },
                xpAwarded: 0,
                avatarId: params.avatarId || "default",
                notes: params.notes,
            };
        }

        existing.completed = true;
        existing.completedAt = completedAt;
        existing.updated_at = incomingUpdatedAt;

        const xpAwarded = params.xpAwarded ?? existing.xpReward ?? 10;
        const avatarId = params.avatarId || "default";

        return {
            task: { ...existing },
            xpAwarded,
            avatarId,
            notes: params.notes,
        };
    }
}
