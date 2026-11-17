import {
    type Habit,
    type HabitCompletion,
    type HabitStreak,
    type CreateHabitParams,
    type UpdateHabitParams,
    type ListHabitsParams,
    type DeleteHabitParams,
    type TrackHabitParams,
    type GetHabitCompletionsParams,
    type GetHabitStreakParams,
    type TrackHabitResult,
    type HabitDeleteResult,
    validateCreateHabitParams,
    validateUpdateHabitParams,
    validateTrackHabitParams,
    calculateHabitStreak,
    shouldApplyLwwUpdate,
    generateId,
} from "@liferpg/sdk";

export class HabitStoreError extends Error {
    public code: string;
    public data?: unknown;

    constructor(code: string, message: string, data?: unknown) {
        super(message);
        this.name = "HabitStoreError";
        this.code = code;
        this.data = data;
    }
}

export class LocalHabitStore {
    private habits = new Map<string, Habit>();
    private tombstones = new Map<string, number>();
    // Append-only completion event log (ADR-0001)
    private completions: HabitCompletion[] = [];

    public createHabit(params: CreateHabitParams): Habit {
        const validation = validateCreateHabitParams(params);
        if (!validation.valid) {
            throw new HabitStoreError(
                "VALIDATION_FAILED",
                validation.errors?.join("; ") || "Invalid params"
            );
        }

        const now = Date.now();
        const id = params.id || generateId("habit");
        const created_at = params.created_at ?? now;
        const updated_at = params.updated_at ?? created_at;

        // If tombstone exists with later or equal timestamp, write is suppressed under LWW
        const tombstone = this.tombstones.get(id);
        if (tombstone !== undefined && !shouldApplyLwwUpdate(tombstone, updated_at)) {
            throw new HabitStoreError("CONFLICT", `Habit '${id}' was deleted more recently.`);
        }

        const existing = this.habits.get(id);
        if (existing) {
            if (shouldApplyLwwUpdate(existing.updated_at, updated_at)) {
                existing.name = params.name;
                existing.description = params.description;
                existing.timeBlockId = params.timeBlockId;
                existing.statId = params.statId;
                existing.xpReward = params.xpReward;
                existing.frequency = params.frequency;
                existing.daysOfWeek = params.daysOfWeek;
                existing.targetPerDay = params.targetPerDay;
                existing.updated_at = updated_at;
            }
            return { ...this.habits.get(id)! };
        }

        this.tombstones.delete(id);

        const habit: Habit = {
            id,
            name: params.name,
            description: params.description,
            timeBlockId: params.timeBlockId,
            statId: params.statId,
            xpReward: params.xpReward ?? 10,
            frequency: params.frequency,
            daysOfWeek: params.daysOfWeek ? [...params.daysOfWeek] : undefined,
            targetPerDay: params.targetPerDay,
            archived: false,
            created_at,
            updated_at,
        };

        this.habits.set(id, habit);
        return { ...habit };
    }

    public getHabit(id: string): Habit {
        if (this.tombstones.has(id)) {
            throw new HabitStoreError("NOT_FOUND", `Habit '${id}' not found`);
        }
        const habit = this.habits.get(id);
        if (!habit) {
            throw new HabitStoreError("NOT_FOUND", `Habit '${id}' not found`);
        }
        return { ...habit };
    }

    public listHabits(params?: ListHabitsParams): Habit[] {
        const results: Habit[] = [];
        for (const [id, habit] of this.habits.entries()) {
            if (this.tombstones.has(id)) continue;

            if (params?.archived !== undefined && Boolean(habit.archived) !== params.archived) {
                continue;
            }
            if (params?.timeBlockId !== undefined && habit.timeBlockId !== params.timeBlockId) {
                continue;
            }
            if (params?.statId !== undefined && habit.statId !== params.statId) {
                continue;
            }

            results.push({ ...habit });
        }
        return results;
    }

    public updateHabit(params: UpdateHabitParams): Habit {
        const validation = validateUpdateHabitParams(params);
        if (!validation.valid) {
            throw new HabitStoreError(
                "VALIDATION_FAILED",
                validation.errors?.join("; ") || "Invalid params"
            );
        }

        if (this.tombstones.has(params.id)) {
            throw new HabitStoreError("NOT_FOUND", `Habit '${params.id}' not found`);
        }

        const existing = this.habits.get(params.id);
        if (!existing) {
            throw new HabitStoreError("NOT_FOUND", `Habit '${params.id}' not found`);
        }

        const incomingUpdatedAt = params.updated_at ?? Date.now();

        // Row-Level LWW conflict resolution:
        if (!shouldApplyLwwUpdate(existing.updated_at, incomingUpdatedAt)) {
            return { ...existing };
        }

        if (params.name !== undefined) {
            existing.name = params.name;
        }
        if (params.description !== undefined) {
            existing.description = params.description;
        }
        if (params.timeBlockId !== undefined) {
            existing.timeBlockId = params.timeBlockId === null ? undefined : params.timeBlockId;
        }
        if (params.statId !== undefined) {
            existing.statId = params.statId;
        }
        if (params.xpReward !== undefined) {
            existing.xpReward = params.xpReward;
        }
        if (params.frequency !== undefined) {
            existing.frequency = params.frequency;
        }
        if (params.daysOfWeek !== undefined) {
            existing.daysOfWeek = [...params.daysOfWeek];
        }
        if (params.targetPerDay !== undefined) {
            existing.targetPerDay = params.targetPerDay;
        }
        if (params.archived !== undefined) {
            existing.archived = params.archived;
        }
        existing.updated_at = incomingUpdatedAt;

        return { ...existing };
    }

    public deleteHabit(params: DeleteHabitParams): HabitDeleteResult {
        const id = params.id;
        const habit = this.habits.get(id);
        if (!habit || this.tombstones.has(id)) {
            throw new HabitStoreError("NOT_FOUND", `Habit '${id}' not found`);
        }

        const deleted_at = params.updated_at ?? Date.now();
        this.habits.delete(id);
        this.tombstones.set(id, deleted_at);

        return {
            success: true,
            id,
            deleted_at,
        };
    }

    /**
     * Appends a completion record to the immutable completion log.
     * Prevents multi-device sync overwrites (ADR-0001).
     */
    public trackHabit(params: TrackHabitParams): TrackHabitResult {
        const validation = validateTrackHabitParams(params);
        if (!validation.valid) {
            throw new HabitStoreError(
                "VALIDATION_FAILED",
                validation.errors?.join("; ") || "Invalid params"
            );
        }

        const habit = this.getHabit(params.habitId);

        const now = Date.now();
        const completionId = generateId("completion");
        const completedAt = params.completedAt ?? now;
        const avatarId = params.avatarId || "default";
        const xpAwarded = params.xpAwarded ?? habit.xpReward ?? 10;
        const statId = params.statId ?? habit.statId;

        const completion: HabitCompletion = {
            id: completionId,
            habitId: habit.id,
            avatarId,
            completedAt,
            xpAwarded,
            statId,
            notes: params.notes,
            metadata: params.metadata,
        };

        // Append-only log
        this.completions.push(completion);

        // Derive streak from append-only log
        const streak = this.getStreak({ habitId: habit.id, referenceTimestamp: completedAt });

        return {
            completion: { ...completion },
            habit: { ...habit },
            streak,
            xpAwarded,
        };
    }

    public getCompletions(params?: GetHabitCompletionsParams): HabitCompletion[] {
        let results = [...this.completions];

        if (params?.habitId) {
            results = results.filter((c) => c.habitId === params.habitId);
        }
        if (params?.avatarId) {
            results = results.filter((c) => c.avatarId === params.avatarId);
        }
        if (params?.since !== undefined) {
            results = results.filter((c) => c.completedAt >= params.since!);
        }
        if (params?.until !== undefined) {
            results = results.filter((c) => c.completedAt <= params.until!);
        }

        // Return chronological order
        results.sort((a, b) => a.completedAt - b.completedAt);
        return results.map((c) => ({ ...c }));
    }

    public getStreak(params: GetHabitStreakParams): HabitStreak {
        // Ensure habit exists
        this.getHabit(params.habitId);

        const completions = this.getCompletions({ habitId: params.habitId });
        return calculateHabitStreak(params.habitId, completions, params.referenceTimestamp);
    }

    public clear(): void {
        this.habits.clear();
        this.tombstones.clear();
        this.completions = [];
    }
}
