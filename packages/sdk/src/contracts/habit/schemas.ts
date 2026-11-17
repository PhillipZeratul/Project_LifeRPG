import type {
    CreateHabitParams,
    UpdateHabitParams,
    TrackHabitParams,
} from "./types";
import { validateDaysOfWeek, type ValidationResult } from "../routine/schemas";

export function validateCreateHabitParams(params: unknown): ValidationResult {
    const errors: string[] = [];
    if (!params || typeof params !== "object") {
        return { valid: false, errors: ["Params must be an object"] };
    }

    const p = params as Partial<CreateHabitParams>;
    if (typeof p.name !== "string" || p.name.trim() === "") {
        errors.push("Habit 'name' is required and must be a non-empty string.");
    }

    if (p.description !== undefined && typeof p.description !== "string") {
        errors.push("Habit 'description' must be a string if provided.");
    }

    if (p.timeBlockId !== undefined && typeof p.timeBlockId !== "string") {
        errors.push("Habit 'timeBlockId' must be a string if provided.");
    }

    if (p.statId !== undefined && typeof p.statId !== "string") {
        errors.push("Habit 'statId' must be a string if provided.");
    }

    if (p.xpReward !== undefined) {
        if (typeof p.xpReward !== "number" || p.xpReward < 0 || !Number.isFinite(p.xpReward)) {
            errors.push("Habit 'xpReward' must be a non-negative number if provided.");
        }
    }

    if (p.daysOfWeek !== undefined && !validateDaysOfWeek(p.daysOfWeek)) {
        errors.push("Habit 'daysOfWeek' must be an array of integers between 0 and 6.");
    }

    if (p.frequency !== undefined && !["daily", "weekly", "custom"].includes(p.frequency)) {
        errors.push("Habit 'frequency' must be 'daily', 'weekly', or 'custom'.");
    }

    if (p.targetPerDay !== undefined) {
        if (typeof p.targetPerDay !== "number" || p.targetPerDay <= 0 || !Number.isInteger(p.targetPerDay)) {
            errors.push("Habit 'targetPerDay' must be a positive integer if provided.");
        }
    }

    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
    };
}

export function validateUpdateHabitParams(params: unknown): ValidationResult {
    const errors: string[] = [];
    if (!params || typeof params !== "object") {
        return { valid: false, errors: ["Params must be an object"] };
    }

    const p = params as Partial<UpdateHabitParams>;
    if (typeof p.id !== "string" || p.id.trim() === "") {
        errors.push("Habit 'id' is required for update.");
    }

    if (p.name !== undefined && (typeof p.name !== "string" || p.name.trim() === "")) {
        errors.push("Habit 'name' must be a non-empty string when provided.");
    }

    if (p.description !== undefined && typeof p.description !== "string") {
        errors.push("Habit 'description' must be a string if provided.");
    }

    if (p.timeBlockId !== undefined && p.timeBlockId !== null && typeof p.timeBlockId !== "string") {
        errors.push("Habit 'timeBlockId' must be a string or null if provided.");
    }

    if (p.statId !== undefined && typeof p.statId !== "string") {
        errors.push("Habit 'statId' must be a string if provided.");
    }

    if (p.xpReward !== undefined) {
        if (typeof p.xpReward !== "number" || p.xpReward < 0 || !Number.isFinite(p.xpReward)) {
            errors.push("Habit 'xpReward' must be a non-negative number if provided.");
        }
    }

    if (p.daysOfWeek !== undefined && !validateDaysOfWeek(p.daysOfWeek)) {
        errors.push("Habit 'daysOfWeek' must be an array of integers between 0 and 6.");
    }

    if (p.frequency !== undefined && !["daily", "weekly", "custom"].includes(p.frequency)) {
        errors.push("Habit 'frequency' must be 'daily', 'weekly', or 'custom'.");
    }

    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
    };
}

export function validateTrackHabitParams(params: unknown): ValidationResult {
    const errors: string[] = [];
    if (!params || typeof params !== "object") {
        return { valid: false, errors: ["Params must be an object"] };
    }

    const p = params as Partial<TrackHabitParams>;
    if (typeof p.habitId !== "string" || p.habitId.trim() === "") {
        errors.push("Habit 'habitId' is required for tracking.");
    }

    if (p.xpAwarded !== undefined && (typeof p.xpAwarded !== "number" || p.xpAwarded < 0)) {
        errors.push("Habit 'xpAwarded' must be a non-negative number if provided.");
    }

    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
    };
}
