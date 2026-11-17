import { isValidTimeString, type ValidationResult } from "../routine";
import type {
    CreateCalendarOverrideParams,
    UpdateCalendarOverrideParams,
    GetDayTimelineParams,
    GetTimelineRangeParams,
} from "./types";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(date: unknown): boolean {
    if (typeof date !== "string") return false;
    if (!DATE_REGEX.test(date)) return false;

    const [yearStr, monthStr, dayStr] = date.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);

    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

    const d = new Date(Date.UTC(year, month - 1, day));
    return (
        d.getUTCFullYear() === year &&
        d.getUTCMonth() === month - 1 &&
        d.getUTCDate() === day
    );
}

export function validateGetDayTimelineParams(params: unknown): ValidationResult {
    const errors: string[] = [];
    if (!params || typeof params !== "object") {
        return { valid: false, errors: ["Params must be an object"] };
    }

    const p = params as Partial<GetDayTimelineParams>;
    if (!isValidDateString(p.date)) {
        errors.push("Calendar query 'date' must be in YYYY-MM-DD format.");
    }

    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
    };
}

export function validateGetTimelineRangeParams(params: unknown): ValidationResult {
    const errors: string[] = [];
    if (!params || typeof params !== "object") {
        return { valid: false, errors: ["Params must be an object"] };
    }

    const p = params as Partial<GetTimelineRangeParams>;
    if (!isValidDateString(p.startDate)) {
        errors.push("Timeline range 'startDate' must be in YYYY-MM-DD format.");
    }
    if (!isValidDateString(p.endDate)) {
        errors.push("Timeline range 'endDate' must be in YYYY-MM-DD format.");
    }

    if (isValidDateString(p.startDate) && isValidDateString(p.endDate)) {
        if (p.startDate! > p.endDate!) {
            errors.push("Timeline range 'startDate' cannot be after 'endDate'.");
        }
    }

    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
    };
}

export function validateCreateCalendarOverrideParams(params: unknown): ValidationResult {
    const errors: string[] = [];
    if (!params || typeof params !== "object") {
        return { valid: false, errors: ["Params must be an object"] };
    }

    const p = params as Partial<CreateCalendarOverrideParams>;
    if (!isValidDateString(p.date)) {
        errors.push("Calendar override 'date' must be in YYYY-MM-DD format.");
    }

    const hasTimeBlockId = typeof p.timeBlockId === "string" && p.timeBlockId.trim() !== "";

    if (!hasTimeBlockId && !p.isCancelled) {
        // Standalone date-specific time block requires title, startTime, endTime
        if (typeof p.title !== "string" || p.title.trim() === "") {
            errors.push("Standalone date block requires a non-empty 'title'.");
        }
        if (!isValidTimeString(p.startTime)) {
            errors.push("Standalone date block requires 'startTime' in HH:MM format.");
        }
        if (!isValidTimeString(p.endTime)) {
            errors.push("Standalone date block requires 'endTime' in HH:MM format.");
        }
    } else {
        if (p.title !== undefined && (typeof p.title !== "string" || p.title.trim() === "")) {
            errors.push("Override 'title' must be a non-empty string when provided.");
        }
        if (p.startTime !== undefined && !isValidTimeString(p.startTime)) {
            errors.push("Override 'startTime' must be in HH:MM format.");
        }
        if (p.endTime !== undefined && !isValidTimeString(p.endTime)) {
            errors.push("Override 'endTime' must be in HH:MM format.");
        }
    }

    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
    };
}

export function validateUpdateCalendarOverrideParams(params: unknown): ValidationResult {
    const errors: string[] = [];
    if (!params || typeof params !== "object") {
        return { valid: false, errors: ["Params must be an object"] };
    }

    const p = params as Partial<UpdateCalendarOverrideParams>;
    if (typeof p.id !== "string" || p.id.trim() === "") {
        errors.push("Calendar override 'id' is required for update.");
    }

    if (p.title !== undefined && (typeof p.title !== "string" || p.title.trim() === "")) {
        errors.push("Override 'title' must be a non-empty string when provided.");
    }

    if (p.startTime !== undefined && !isValidTimeString(p.startTime)) {
        errors.push("Override 'startTime' must be in HH:MM format.");
    }

    if (p.endTime !== undefined && !isValidTimeString(p.endTime)) {
        errors.push("Override 'endTime' must be in HH:MM format.");
    }

    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
    };
}
