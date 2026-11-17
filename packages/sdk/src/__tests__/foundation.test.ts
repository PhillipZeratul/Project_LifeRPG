import { describe, it, expect } from "vitest";
import { generateId, shouldApplyLwwUpdate, type AvatarId, type StatId } from "../index";
import * as CalendarFoundation from "../foundation/calendar";

describe("SDK Foundation Layer", () => {
    describe("generateId", () => {
        it("generates IDs with expected prefix and uniqueness", () => {
            const id1 = generateId("task");
            const id2 = generateId("task");
            expect(id1.startsWith("task_")).toBe(true);
            expect(id2.startsWith("task_")).toBe(true);
            expect(id1).not.toBe(id2);
        });
    });

    describe("shouldApplyLwwUpdate", () => {
        it("applies updates when incoming timestamp is greater than or equal to existing", () => {
            expect(shouldApplyLwwUpdate(100, 200)).toBe(true);
            expect(shouldApplyLwwUpdate(200, 200)).toBe(true);
            expect(shouldApplyLwwUpdate(200, 100)).toBe(false);
        });
    });

    describe("Calendar Foundation", () => {
        it("re-exports calendar contracts under foundation/calendar", () => {
            expect(CalendarFoundation.CalendarEvents).toBeDefined();
            expect(CalendarFoundation.CalendarEvents.OverrideCreated).toBe("calendar:override_created");
            expect(typeof CalendarFoundation.validateCreateCalendarOverrideParams).toBe("function");
        });
    });

    describe("Nominal Branded Types", () => {
        it("allows string assignment and casting for AvatarId and StatId", () => {
            const avatarId: AvatarId = "avatar-test-123";
            const statId: StatId = "focus";
            const castedAvatar = "avatar-cast" as AvatarId;
            const rawString: string = avatarId;

            expect(typeof avatarId).toBe("string");
            expect(typeof statId).toBe("string");
            expect(castedAvatar).toBe("avatar-cast");
            expect(rawString).toBe("avatar-test-123");
        });
    });
});
