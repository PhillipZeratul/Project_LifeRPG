export interface TaskSchedule {
    date?: string;
    time?: string;
    timeBlockId?: string;
    timeBlockIds?: string[];
    estimatedDurationMinutes?: number;
}

export interface Task {
    id: string;
    title: string;
    description?: string;
    completed: boolean;
    completedAt?: number;
    statId?: string;
    xpReward?: number;
    timeBlockId?: string | null;
    timeBlockIds?: string[];
    dueDate?: string;
    dueTime?: string;
    schedule?: TaskSchedule;
    archived?: boolean;
    created_at: number;
    updated_at: number;
}

export interface CreateTaskParams {
    id?: string;
    title: string;
    description?: string;
    completed?: boolean;
    statId?: string;
    xpReward?: number;
    timeBlockId?: string;
    timeBlockIds?: string[];
    dueDate?: string;
    dueTime?: string;
    schedule?: TaskSchedule;
    created_at?: number;
    updated_at?: number;
}

export interface UpdateTaskParams {
    id: string;
    title?: string;
    description?: string;
    completed?: boolean;
    completedAt?: number;
    statId?: string;
    xpReward?: number;
    timeBlockId?: string | null;
    timeBlockIds?: string[] | null;
    dueDate?: string | null;
    dueTime?: string | null;
    schedule?: TaskSchedule | null;
    archived?: boolean;
    updated_at?: number;
}

export interface ScheduleTaskParams {
    id: string;
    timeBlockId?: string | null;
    timeBlockIds?: string[] | null;
    dueDate?: string | null;
    dueTime?: string | null;
    schedule?: TaskSchedule | null;
    updated_at?: number;
}

export interface CompleteTaskParams {
    id: string;
    avatarId?: string;
    notes?: string;
    completedAt?: number;
    xpAwarded?: number;
    statId?: string;
    metadata?: Record<string, unknown>;
    updated_at?: number;
}

export interface GetTaskParams {
    id: string;
}

export interface ListTasksParams {
    timeBlockId?: string;
    completed?: boolean;
    statId?: string;
    dueDate?: string;
    archived?: boolean;
}

export interface DeleteTaskParams {
    id: string;
    updated_at?: number;
}

export interface TaskDeleteResult {
    success: boolean;
    id: string;
    deleted_at: number;
}

export interface CompleteTaskResult {
    task: Task;
    xpAwarded: number;
    avatarId: string;
    notes?: string;
}

export interface TaskCompletionEvent {
    task: Task;
    xpAwarded: number;
    statId?: string;
    avatarId: string;
    notes?: string;
}

export interface TaskScheduleEvent {
    task: Task;
    previousSchedule?: TaskSchedule;
}

export interface TaskServiceContract {
    create(params: CreateTaskParams): Promise<Task>;
    get(params: GetTaskParams): Promise<Task>;
    list(params?: ListTasksParams): Promise<Task[]>;
    update(params: UpdateTaskParams): Promise<Task>;
    delete(params: DeleteTaskParams): Promise<TaskDeleteResult>;
    schedule(params: ScheduleTaskParams): Promise<Task>;
    complete(params: CompleteTaskParams): Promise<CompleteTaskResult>;
}
