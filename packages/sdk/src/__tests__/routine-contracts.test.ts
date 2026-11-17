import { describe, it, expect } from "vitest";
import {
    validateCreateRoutineParams,
    validateUpdateRoutineParams,
    validateCreateTimeBlockParams,
    validateUpdateTimeBlockParams,
    isValidTimeString,
    shouldApplyLwwUpdate,
} from "../contracts/routine";

describe("Routine and Time Block Contracts & Schema Validation", () => {
    it("validates time string formats correctly", () => {
        expect(isValidTimeString("09:00")).toBe(true);
        expect(isValidTimeString("23:59")).toBe(true);
        expect(isValidTimeString("00:00")).toBe(true);
        expect(isValidTimeString("24:00")).toBe(false);
        expect(isValidTimeString("9:00")).toBe(false);
        expect(isValidTimeString("invalid")).toBe(false);
        expect(isValidTimeString(123)).toBe(false);
    });

    it("validates CreateRoutineParams correctly", () => {
        const valid = validateCreateRoutineParams({
            name: "Morning Flow",
            description: "Start of day routine",
            daysOfWeek: [1, 2, 3, 4, 5],
        });
        expect(valid.valid).toBe(true);

        const missingName = validateCreateRoutineParams({
            name: "   ",
        });
        expect(missingName.valid).toBe(false);
        expect(missingName.errors).toBeDefined();

        const invalidDays = validateCreateRoutineParams({
            name: "Weekend Routine",
            daysOfWeek: [7, 8],
        });
        expect(invalidDays.valid).toBe(false);
    });

    it("validates UpdateRoutineParams correctly", () => {
        const valid = validateUpdateRoutineParams({
            id: "routine-1",
            name: "Updated Name",
            daysOfWeek: [1, 2],
        });
        expect(valid.valid).toBe(true);

        const missingId = validateUpdateRoutineParams({
            name: "Missing ID",
        });
        expect(missingId.valid).toBe(false);
    });

    it("validates CreateTimeBlockParams correctly", () => {
        const valid = validateCreateTimeBlockParams({
            routineId: "routine-1",
            title: "Deep Work",
            startTime: "09:00",
            endTime: "11:00",
        });
        expect(valid.valid).toBe(true);

        const invalidTime = validateCreateTimeBlockParams({
            routineId: "routine-1",
            title: "Deep Work",
            startTime: "9am",
            endTime: "11am",
        });
        expect(invalidTime.valid).toBe(false);
    });

    it("validates UpdateTimeBlockParams correctly", () => {
        const valid = validateUpdateTimeBlockParams({
            id: "tb-1",
            title: "Updated Title",
            startTime: "10:00",
            endTime: "11:00",
        });
        expect(valid.valid).toBe(true);

        const missingId = validateUpdateTimeBlockParams({
            title: "Missing ID",
        });
        expect(missingId.valid).toBe(false);
    });

    it("evaluates LWW conflict resolution correctly", () => {
        expect(shouldApplyLwwUpdate(100, 150)).toBe(true);
        expect(shouldApplyLwwUpdate(100, 100)).toBe(true);
        expect(shouldApplyLwwUpdate(150, 100)).toBe(false);
    });
});
