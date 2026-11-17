import { describe, it, expect } from "vitest";
import {
    validateCreateCalendarOverrideParams,
    validateUpdateCalendarOverrideParams,
    validateGetDayTimelineParams,
    validateGetTimelineRangeParams,
    isValidDateString,
    CalendarEvents,
} from "../contracts/calendar";

describe("Calendar Contracts & Schema Validation", () => {
    it("validates date string formats correctly (YYYY-MM-DD)", () => {
        expect(isValidDateString("2026-11-17")).toBe(true);
        expect(isValidDateString("2026-02-28")).toBe(true);
        expect(isValidDateString("2026-13-01")).toBe(false);
        expect(isValidDateString("2026-00-10")).toBe(false);
        expect(isValidDateString("2026-11-32")).toBe(false);
        expect(isValidDateString("11-17-2026")).toBe(false);
        expect(isValidDateString("2026/11/17")).toBe(false);
        expect(isValidDateString("invalid")).toBe(false);
        expect(isValidDateString(null)).toBe(false);
    });

    it("validates GetDayTimelineParams correctly", () => {
        expect(validateGetDayTimelineParams({ date: "2026-11-17" }).valid).toBe(true);
        expect(validateGetDayTimelineParams({ date: "invalid-date" }).valid).toBe(false);
        expect(validateGetDayTimelineParams({}).valid).toBe(false);
    });

    it("validates GetTimelineRangeParams correctly", () => {
        expect(
            validateGetTimelineRangeParams({
                startDate: "2026-11-17",
                endDate: "2026-11-20",
            }).valid,
        ).toBe(true);

        // Same day range is valid
        expect(
            validateGetTimelineRangeParams({
                startDate: "2026-11-17",
                endDate: "2026-11-17",
            }).valid,
        ).toBe(true);

        // End date before start date is invalid
        const inverted = validateGetTimelineRangeParams({
            startDate: "2026-11-20",
            endDate: "2026-11-17",
        });
        expect(inverted.valid).toBe(false);
        expect(inverted.errors).toBeDefined();

        // Invalid date format
        expect(
            validateGetTimelineRangeParams({
                startDate: "bad",
                endDate: "2026-11-20",
            }).valid,
        ).toBe(false);
    });

    it("validates CreateCalendarOverrideParams correctly", () => {
        // Valid routine time block modification override
        expect(
            validateCreateCalendarOverrideParams({
                date: "2026-11-17",
                timeBlockId: "tb-1",
                startTime: "09:30",
                endTime: "11:00",
                title: "Rescheduled Deep Work",
            }).valid,
        ).toBe(true);

        // Valid cancellation override
        expect(
            validateCreateCalendarOverrideParams({
                date: "2026-11-17",
                timeBlockId: "tb-1",
                isCancelled: true,
            }).valid,
        ).toBe(true);

        // Valid standalone date block override
        expect(
            validateCreateCalendarOverrideParams({
                date: "2026-11-17",
                title: "Doctor Appointment",
                startTime: "14:00",
                endTime: "15:00",
            }).valid,
        ).toBe(true);

        // Standalone block missing title or time
        const missingTitle = validateCreateCalendarOverrideParams({
            date: "2026-11-17",
            startTime: "14:00",
            endTime: "15:00",
        });
        expect(missingTitle.valid).toBe(false);

        // Invalid time format
        expect(
            validateCreateCalendarOverrideParams({
                date: "2026-11-17",
                timeBlockId: "tb-1",
                startTime: "9:00",
            }).valid,
        ).toBe(false);
    });

    it("validates UpdateCalendarOverrideParams correctly", () => {
        expect(
            validateUpdateCalendarOverrideParams({
                id: "override-1",
                title: "Updated Title",
                startTime: "10:00",
            }).valid,
        ).toBe(true);

        expect(
            validateUpdateCalendarOverrideParams({
                title: "Missing ID",
            }).valid,
        ).toBe(false);
    });

    it("defines Calendar event names correctly", () => {
        expect(CalendarEvents.OverrideCreated).toBe("calendar:override_created");
        expect(CalendarEvents.OverrideUpdated).toBe("calendar:override_updated");
        expect(CalendarEvents.OverrideDeleted).toBe("calendar:override_deleted");
    });
});
