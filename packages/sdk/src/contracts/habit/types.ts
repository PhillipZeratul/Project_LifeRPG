export interface Habit {
    id: string;
    name: string;
    description?: string;
    timeBlockId?: string; // Anchored to a Time Block, or undefined for standalone habit
    statId?: string;      // Associated Avatar Stat (e.g. "focus", "vitality", "intellect")
    xpReward?: number;    // Additive Experience points awarded upon fulfillment
    frequency?: "daily" | "weekly" | "custom";
    daysOfWeek?: number[]; // [0..6]
    targetPerDay?: number; // e.g. 1
    archived?: boolean;
    created_at: number;
    updated_at: number;
}

export interface HabitCompletion {
    id: string;
    habitId: string;
    avatarId: string;
    completedAt: number;
    xpAwarded: number;
    statId?: string;
    notes?: string;
    metadata?: Record<string, unknown>;
}

export interface HabitStreak {
    habitId: string;
    currentStreak: number;
    longestStreak: number;
    totalCompletions: number;
    lastCompletedAt?: number;
}

export interface CreateHabitParams {
    id?: string;
    name: string;
    description?: string;
    timeBlockId?: string;
    statId?: string;
    xpReward?: number;
    frequency?: "daily" | "weekly" | "custom";
    daysOfWeek?: number[];
    targetPerDay?: number;
    created_at?: number;
    updated_at?: number;
}

export interface UpdateHabitParams {
    id: string;
    name?: string;
    description?: string;
    timeBlockId?: string | null; // null unanchors from time block
    statId?: string;
    xpReward?: number;
    frequency?: "daily" | "weekly" | "custom";
    daysOfWeek?: number[];
    targetPerDay?: number;
    archived?: boolean;
    updated_at?: number;
}

export interface GetHabitParams {
    id: string;
}

export interface ListHabitsParams {
    timeBlockId?: string;
    archived?: boolean;
    statId?: string;
}

export interface DeleteHabitParams {
    id: string;
    updated_at?: number;
}

export interface TrackHabitParams {
    habitId: string;
    avatarId?: string;
    completedAt?: number;
    notes?: string;
    xpAwarded?: number;
    statId?: string;
    metadata?: Record<string, unknown>;
}

export interface GetHabitCompletionsParams {
    habitId?: string;
    avatarId?: string;
    since?: number;
    until?: number;
}

export interface GetHabitStreakParams {
    habitId: string;
    referenceTimestamp?: number;
}

export interface TrackHabitResult {
    completion: HabitCompletion;
    habit: Habit;
    streak: HabitStreak;
    xpAwarded: number;
}

export interface HabitCompletionEvent {
    habit: Habit;
    completion: HabitCompletion;
    xpAwarded: number;
    statId?: string;
    avatarId: string;
}

export interface HabitDeleteResult {
    success: boolean;
    id: string;
    deleted_at: number;
}

export interface HabitServiceContract {
    create(params: CreateHabitParams): Promise<Habit>;
    get(params: GetHabitParams): Promise<Habit>;
    list(params?: ListHabitsParams): Promise<Habit[]>;
    update(params: UpdateHabitParams): Promise<Habit>;
    delete(params: DeleteHabitParams): Promise<HabitDeleteResult>;
    track(params: TrackHabitParams): Promise<TrackHabitResult>;
    getCompletions(params?: GetHabitCompletionsParams): Promise<HabitCompletion[]>;
    getStreak(params: GetHabitStreakParams): Promise<HabitStreak>;
}
