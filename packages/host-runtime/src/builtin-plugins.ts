import type { IPluginManifest, BasePlugin, IPluginContext } from "@liferpg/sdk";
import timerManifest from "@liferpg/plugin-core-timer/manifest.json";
import routineManifest from "@liferpg/plugin-core-routine/manifest.json";
import calendarManifest from "@liferpg/plugin-core-calendar/manifest.json";
import habitManifest from "@liferpg/plugin-core-habit/manifest.json";
import taskManifest from "@liferpg/plugin-core-task/manifest.json";

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
    "@liferpg/plugin-core-calendar": {
        manifest: calendarManifest as unknown as IPluginManifest,
        loader: () => import("@liferpg/plugin-core-calendar"),
        service: {
            id: "calendar",
            methods: [
                "calendar.getDayTimeline",
                "calendar.getTimelineRange",
                "calendar.createOverride",
                "calendar.getOverride",
                "calendar.listOverrides",
                "calendar.updateOverride",
                "calendar.deleteOverride",
            ],
        },
    },
    "@liferpg/plugin-core-habit": {
        manifest: habitManifest as unknown as IPluginManifest,
        loader: () => import("@liferpg/plugin-core-habit"),
        service: {
            id: "habit",
            methods: [
                "habit.create",
                "habit.get",
                "habit.list",
                "habit.update",
                "habit.delete",
                "habit.track",
                "habit.complete",
                "habit.getCompletions",
                "habit.getStreak",
            ],
        },
    },
    "@liferpg/plugin-core-task": {
        manifest: taskManifest as unknown as IPluginManifest,
        loader: () => import("@liferpg/plugin-core-task"),
        service: {
            id: "task",
            methods: [
                "task.create",
                "task.get",
                "task.list",
                "task.update",
                "task.delete",
                "task.schedule",
                "task.complete",
            ],
        },
    },
};
