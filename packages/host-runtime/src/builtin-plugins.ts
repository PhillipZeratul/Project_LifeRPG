import type { IPluginManifest, BasePlugin, IPluginContext } from "@liferpg/sdk";
import timerManifest from "@liferpg/plugin-core-timer/manifest.json";
import routineManifest from "@liferpg/plugin-core-routine/manifest.json";

export interface PluginDefinition {
    manifest: IPluginManifest;
    loader: () => Promise<{default: new (ctx: IPluginContext) => BasePlugin}>;
    service?: {
        id: string;
        methods?: string[];
    };
}

export const BUILTIN_PLUGINS: Record<string, PluginDefinition> = {
    "@liferpg/plugin-core-timer": {
        manifest: timerManifest as unknown as IPluginManifest,
        loader: () => import("@liferpg/plugin-core-timer"),
    },
    "@liferpg/plugin-core-routine": {
        manifest: routineManifest as unknown as IPluginManifest,
        loader: () => import("@liferpg/plugin-core-routine"),
        service: {
            id: "routine",
            methods: [
                "routine.create",
                "routine.get",
                "routine.list",
                "routine.update",
                "routine.delete",
                "routine.createTimeBlock",
                "routine.getTimeBlock",
                "routine.listTimeBlocks",
                "routine.updateTimeBlock",
                "routine.deleteTimeBlock",
            ],
        },
    },
};
