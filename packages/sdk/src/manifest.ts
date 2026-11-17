export const STANDARD_PERMISSIONS = [
    "avatar:read",
    "avatar:write",
    "habits:read",
    "habits:track",
    "habits:write",
    "tasks:read",
    "tasks:write",
    "calendar:read",
    "calendar:write",
    "routines:read",
    "routines:write",
    "goals:read",
    "goals:write",
    "stats:read",
    "stats:write",
    "skills:read",
    "skills:write",
    "xp:read",
    "xp:grant",
    "notifications:send",
    "storage:read",
    "storage:write",
] as const;

export type StandardPluginPermission = (typeof STANDARD_PERMISSIONS)[number];
export type PluginPermission = StandardPluginPermission | (string & {});

export interface IPluginManifest {
    name: string;
    version: string;
    displayName: string;
    author: string;
    description: string;
    dependencies?: Record<string, string>;
    permissions?: PluginPermission[];
}

export interface ManifestValidationResult {
    valid: boolean;
    errors?: string[];
}

export function isValidPermissionFormat(permission: unknown): permission is PluginPermission {
    if (typeof permission !== "string" || permission.trim().length === 0) {
        return false;
    }
    const permissionRegex = /^([a-z0-9_-]+:([a-z0-9_-]+|\*)|\*)$/i;
    return permissionRegex.test(permission);
}

export function validatePluginManifest(manifest: unknown): ManifestValidationResult {
    const errors: string[] = [];

    if (!manifest || typeof manifest !== "object") {
        return { valid: false, errors: ["Manifest must be a non-null object"] };
    }

    const candidate = manifest as Record<string, unknown>;

    const requiredFields = ["name", "version", "displayName", "author", "description"];
    for (const field of requiredFields) {
        if (typeof candidate[field] !== "string" || (candidate[field] as string).trim() === "") {
            errors.push(`Manifest field '${field}' is required and must be a non-empty string.`);
        }
    }

    if (candidate.permissions !== undefined) {
        if (!Array.isArray(candidate.permissions)) {
            errors.push("Manifest 'permissions' must be an array of capability strings.");
        } else {
            candidate.permissions.forEach((perm, index) => {
                if (!isValidPermissionFormat(perm)) {
                    errors.push(
                        `Invalid permission declaration at index ${index}: '${String(perm)}'. Expected format '<resource>:<action>' (e.g. 'avatar:read', 'habits:track') or wildcard '*'.`
                    );
                }
            });
        }
    }

    if (errors.length > 0) {
        return { valid: false, errors };
    }

    return { valid: true };
}

export function assertValidPluginManifest(manifest: unknown): asserts manifest is IPluginManifest {
    const result = validatePluginManifest(manifest);
    if (!result.valid) {
        throw new Error(`Invalid plugin manifest:\n  - ${result.errors?.join("\n  - ")}`);
    }
}
