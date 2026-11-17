import type { CreateRoutineParams, UpdateRoutineParams, CreateTimeBlockParams, UpdateTimeBlockParams } from "./types";

export interface ValidationResult {
    valid: boolean;
    errors?: string[];
}

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTimeString(time: unknown): boolean {
    if (typeof time !== "string") return false;
    return TIME_REGEX.test(time);
}

export function validateDaysOfWeek(days: unknown): boolean {
    if (!Array.isArray(days)) return false;
    return days.every((d) => typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 6);
}

export function validateCreateRoutineParams(params: unknown): ValidationResult {
    const errors: string[] = [];
    if (!params || typeof params !== "object") {
        return { valid: false, errors: ["Params must be an object"] };
    }

    const p = params as Partial<CreateRoutineParams>;
    if (typeof p.name !== "string" || p.name.trim() === "") {
        errors.push("Routine 'name' is required and must be a non-empty string.");
    }

    if (p.daysOfWeek !== undefined && !validateDaysOfWeek(p.daysOfWeek)) {
        errors.push("Routine 'daysOfWeek' must be an array of integers between 0 and 6.");
    }

    if (p.description !== undefined && typeof p.description !== "string") {
        errors.push("Routine 'description' must be a string if provided.");
    }

    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
    };
}

export function validateUpdateRoutineParams(params: unknown): ValidationResult {
    const errors: string[] = [];
    if (!params || typeof params !== "object") {
        return { valid: false, errors: ["Params must be an object"] };
    }

    const p = params as Partial<UpdateRoutineParams>;
    if (typeof p.id !== "string" || p.id.trim() === "") {
        errors.push("Routine 'id' is required for update.");
    }

    if (p.name !== undefined && (typeof p.name !== "string" || p.name.trim() === "")) {
        errors.push("Routine 'name' must be a non-empty string when provided.");
    }

    if (p.daysOfWeek !== undefined && !validateDaysOfWeek(p.daysOfWeek)) {
        errors.push("Routine 'daysOfWeek' must be an array of integers between 0 and 6.");
    }

    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
    };
}

export function validateCreateTimeBlockParams(params: unknown): ValidationResult {
    const errors: string[] = [];
    if (!params || typeof params !== "object") {
        return { valid: false, errors: ["Params must be an object"] };
    }

    const p = params as Partial<CreateTimeBlockParams>;
    if (typeof p.routineId !== "string" || p.routineId.trim() === "") {
        errors.push("TimeBlock 'routineId' is required.");
    }

    if (typeof p.title !== "string" || p.title.trim() === "") {
        errors.push("TimeBlock 'title' is required and must be a non-empty string.");
    }

    if (!isValidTimeString(p.startTime)) {
        errors.push("TimeBlock 'startTime' must be in HH:MM format (e.g. '09:00').");
    }

    if (!isValidTimeString(p.endTime)) {
        errors.push("TimeBlock 'endTime' must be in HH:MM format (e.g. '10:30').");
    }

    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
    };
}

export function validateUpdateTimeBlockParams(params: unknown): ValidationResult {
    const errors: string[] = [];
    if (!params || typeof params !== "object") {
        return { valid: false, errors: ["Params must be an object"] };
    }

    const p = params as Partial<UpdateTimeBlockParams>;
    if (typeof p.id !== "string" || p.id.trim() === "") {
        errors.push("TimeBlock 'id' is required for update.");
    }

    if (p.title !== undefined && (typeof p.title !== "string" || p.title.trim() === "")) {
        errors.push("TimeBlock 'title' must be a non-empty string when provided.");
    }

    if (p.startTime !== undefined && !isValidTimeString(p.startTime)) {
        errors.push("TimeBlock 'startTime' must be in HH:MM format (e.g. '09:00').");
    }

    if (p.endTime !== undefined && !isValidTimeString(p.endTime)) {
        errors.push("TimeBlock 'endTime' must be in HH:MM format (e.g. '10:30').");
    }

    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
    };
}
