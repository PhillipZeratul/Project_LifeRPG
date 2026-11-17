export interface TimeBlock {
    id: string;
    routineId: string;
    title: string;
    description?: string;
    startTime: string; // e.g. "09:00"
    endTime: string;   // e.g. "10:30"
    color?: string;
    created_at: number;
    updated_at: number;
}

export interface Routine {
    id: string;
    name: string;
    description?: string;
    daysOfWeek?: number[]; // [0..6] where 0 = Sunday, 1 = Monday, etc.
    timeBlocks: TimeBlock[];
    created_at: number;
    updated_at: number;
}

export interface CreateRoutineParams {
    id?: string;
    name: string;
    description?: string;
    daysOfWeek?: number[];
    timeBlocks?: Array<Omit<CreateTimeBlockParams, "routineId">>;
    created_at?: number;
    updated_at?: number;
}

export interface UpdateRoutineParams {
    id: string;
    name?: string;
    description?: string;
    daysOfWeek?: number[];
    updated_at?: number;
}

export interface GetRoutineParams {
    id: string;
}

export interface ListRoutinesParams {
    dayOfWeek?: number;
}

export interface DeleteRoutineParams {
    id: string;
    updated_at?: number;
}

export interface CreateTimeBlockParams {
    id?: string;
    routineId: string;
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    color?: string;
    created_at?: number;
    updated_at?: number;
}

export interface UpdateTimeBlockParams {
    id: string;
    title?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    color?: string;
    updated_at?: number;
}

export interface GetTimeBlockParams {
    id: string;
}

export interface ListTimeBlocksParams {
    routineId?: string;
}

export interface DeleteTimeBlockParams {
    id: string;
    updated_at?: number;
}

export interface DeleteEntityResult {
    success: boolean;
    id: string;
    deleted_at: number;
}

export interface RoutineServiceContract {
    create(params: CreateRoutineParams): Promise<Routine>;
    get(params: GetRoutineParams): Promise<Routine>;
    list(params?: ListRoutinesParams): Promise<Routine[]>;
    update(params: UpdateRoutineParams): Promise<Routine>;
    delete(params: DeleteRoutineParams): Promise<DeleteEntityResult>;
    createTimeBlock(params: CreateTimeBlockParams): Promise<TimeBlock>;
    getTimeBlock(params: GetTimeBlockParams): Promise<TimeBlock>;
    listTimeBlocks(params?: ListTimeBlocksParams): Promise<TimeBlock[]>;
    updateTimeBlock(params: UpdateTimeBlockParams): Promise<TimeBlock>;
    deleteTimeBlock(params: DeleteTimeBlockParams): Promise<DeleteEntityResult>;
}
