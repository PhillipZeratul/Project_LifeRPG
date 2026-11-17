import type { ValidationResult } from "../routine/schemas";
import type {
    CreateTaskParams,
    UpdateTaskParams,
    ScheduleTaskParams,
    CompleteTaskParams,
} from "./types";

export function validateCreateTaskParams(params: unknown): ValidationResult {
    const errors: string[] = [];
    if (!params || typeof params !== "object") {
        return { valid: false, errors: ["Params must be an object"] };
    }

    const p = params as Partial<CreateTaskParams>;
    if (typeof p.title !== "string" || p.title.trim() === "") {
        errors.push("Task 'title' is required and must be a non-empty string.");
    }

    if (p.description !== undefined && typeof p.description !== "string") {
        errors.push("Task 'description' must be a string if provided.");
    }

    if (p.statId !== undefined && typeof p.statId !== "string") {
        errors.push("Task 'statId' must be a string if provided.");
    }

    if (p.xpReward !== undefined) {
        if (typeof p.xpReward !== "number" || p.xpReward < 0 || !Number.isFinite(p.xpReward)) {
            errors.push("Task 'xpReward' must be a non-negative number if provided.");
        }
    }

    if (p.timeBlockId !== undefined && typeof p.timeBlockId !== "string") {
        errors.push("Task 'timeBlockId' must be a string if provided.");
    }

    if (p.timeBlockIds !== undefined && (!Array.isArray(p.timeBlockIds) || !p.timeBlockIds.every((id) => typeof id === "string"))) {
        errors.push("Task 'timeBlockIds' must be an array of strings if provided.");
    }

    if (p.dueDate !== undefined && typeof p.dueDate !== "string") {
        errors.push("Task 'dueDate' must be a string if provided.");
    }

    if (p.dueTime !== undefined && typeof p.dueTime !== "string") {
        errors.push("Task 'dueTime' must be a string if provided.");
    }

    if (p.schedule !== undefined && (typeof p.schedule !== "object" || p.schedule === null)) {
        errors.push("Task 'schedule' must be an object if provided.");
    }

    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
    };
}

export function validateUpdateTaskParams(params: unknown): ValidationResult {
    const errors: string[] = [];
    if (!params || typeof params !== "object") {
        return { valid: false, errors: ["Params must be an object"] };
    }

    const p = params as Partial<UpdateTaskParams>;
    if (typeof p.id !== "string" || p.id.trim() === "") {
        errors.push("Task 'id' is required for update.");
    }

    if (p.title !== undefined && (typeof p.title !== "string" || p.title.trim() === "")) {
        errors.push("Task 'title' must be a non-empty string when provided.");
    }

    if (p.description !== undefined && typeof p.description !== "string") {
        errors.push("Task 'description' must be a string if provided.");
    }

    if (p.completed !== undefined && typeof p.completed !== "boolean") {
        errors.push("Task 'completed' must be a boolean if provided.");
    }

    if (p.statId !== undefined && typeof p.statId !== "string") {
        errors.push("Task 'statId' must be a string if provided.");
    }

    if (p.xpReward !== undefined) {
        if (typeof p.xpReward !== "number" || p.xpReward < 0 || !Number.isFinite(p.xpReward)) {
            errors.push("Task 'xpReward' must be a non-negative number if provided.");
        }
    }

    if (p.timeBlockId !== undefined && p.timeBlockId !== null && typeof p.timeBlockId !== "string") {
        errors.push("Task 'timeBlockId' must be a string or null if provided.");
    }

    if (p.timeBlockIds !== undefined && p.timeBlockIds !== null && (!Array.isArray(p.timeBlockIds) || !p.timeBlockIds.every((id) => typeof id === "string"))) {
        errors.push("Task 'timeBlockIds' must be an array of strings or null if provided.");
    }

    if (p.dueDate !== undefined && p.dueDate !== null && typeof p.dueDate !== "string") {
        errors.push("Task 'dueDate' must be a string or null if provided.");
    }

    if (p.dueTime !== undefined && p.dueTime !== null && typeof p.dueTime !== "string") {
        errors.push("Task 'dueTime' must be a string or null if provided.");
    }

    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
    };
}

export function validateScheduleTaskParams(params: unknown): ValidationResult {
    const errors: string[] = [];
    if (!params || typeof params !== "object") {
        return { valid: false, errors: ["Params must be an object"] };
    }

    const p = params as Partial<ScheduleTaskParams>;
    if (typeof p.id !== "string" || p.id.trim() === "") {
        errors.push("Task 'id' is required for scheduling.");
    }

    if (p.timeBlockId !== undefined && p.timeBlockId !== null && typeof p.timeBlockId !== "string") {
        errors.push("Task 'timeBlockId' must be a string or null if provided.");
    }

    if (p.timeBlockIds !== undefined && p.timeBlockIds !== null && (!Array.isArray(p.timeBlockIds) || !p.timeBlockIds.every((id) => typeof id === "string"))) {
        errors.push("Task 'timeBlockIds' must be an array of strings or null if provided.");
    }

    if (p.dueDate !== undefined && p.dueDate !== null && typeof p.dueDate !== "string") {
        errors.push("Task 'dueDate' must be a string or null if provided.");
    }

    if (p.dueTime !== undefined && p.dueTime !== null && typeof p.dueTime !== "string") {
        errors.push("Task 'dueTime' must be a string or null if provided.");
    }

    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
    };
}

export function validateCompleteTaskParams(params: unknown): ValidationResult {
    const errors: string[] = [];
    if (!params || typeof params !== "object") {
        return { valid: false, errors: ["Params must be an object"] };
    }

    const p = params as Partial<CompleteTaskParams>;
    if (typeof p.id !== "string" || p.id.trim() === "") {
        errors.push("Task 'id' is required for completion.");
    }

    if (p.avatarId !== undefined && typeof p.avatarId !== "string") {
        errors.push("Task 'avatarId' must be a string if provided.");
    }

    if (p.xpAwarded !== undefined && (typeof p.xpAwarded !== "number" || p.xpAwarded < 0)) {
        errors.push("Task 'xpAwarded' must be a non-negative number if provided.");
    }

    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
    };
}
