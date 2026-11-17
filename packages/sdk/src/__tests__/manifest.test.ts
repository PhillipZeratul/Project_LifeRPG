import { describe, it, expect } from "vitest";
import {
    validatePluginManifest,
    assertValidPluginManifest,
    type IPluginManifest,
    STANDARD_PERMISSIONS,
} from "../index";

describe("Plugin Manifest & Permission Schema", () => {
    it("validates a manifest with standard granular capabilities", () => {
        const manifest: IPluginManifest = {
            name: "@liferpg/plugin-avatar-stats",
            version: "1.0.0",
            displayName: "Avatar Stats",
            author: "Test Author",
            description: "Displays avatar stats and tracks habits",
            permissions: ["avatar:read", "habits:track"],
        };

        const result = validatePluginManifest(manifest);
        expect(result.valid).toBe(true);
        expect(result.errors).toBeUndefined();
        expect(() => assertValidPluginManifest(manifest)).not.toThrow();
    });

    it("validates a manifest with wildcard capability permissions", () => {
        const manifest: IPluginManifest = {
            name: "@liferpg/plugin-all-avatar",
            version: "0.2.1",
            displayName: "All Avatar",
            author: "Test Author",
            description: "Full avatar access",
            permissions: ["avatar:*"],
        };

        const result = validatePluginManifest(manifest);
        expect(result.valid).toBe(true);
    });

    it("rejects a manifest with malformed permission format", () => {
        const invalidManifest = {
            name: "@liferpg/plugin-invalid",
            version: "1.0.0",
            displayName: "Invalid Plugin",
            author: "Test",
            description: "Has bad permissions",
            permissions: ["invalid_permission_without_colon", 123, ":bad"],
        };

        const result = validatePluginManifest(invalidManifest);
        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors?.length).toBeGreaterThan(0);

        expect(() => assertValidPluginManifest(invalidManifest)).toThrow();
    });

    it("rejects a manifest missing mandatory metadata fields", () => {
        const incompleteManifest = {
            name: "@liferpg/incomplete",
            permissions: ["avatar:read"],
        };

        const result = validatePluginManifest(incompleteManifest);
        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
    });

    it("exposes known standard permissions for LifeRPG domain", () => {
        expect(STANDARD_PERMISSIONS).toContain("avatar:read");
        expect(STANDARD_PERMISSIONS).toContain("habits:track");
        expect(STANDARD_PERMISSIONS).toContain("tasks:read");
        expect(STANDARD_PERMISSIONS).toContain("calendar:read");
    });
});
