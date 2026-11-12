import type { IPluginManifest, BasePlugin, IPluginContext } from "@liferpg/sdk";
import timerManifest from "@liferpg/plugin-core-timer/manifest.json";

export interface PluginDefinition {
    manifest: IPluginManifest;
    loader: () => Promise<{default: new (ctx: IPluginContext) => BasePlugin}>;
}

export const BUILTIN_PLUGINS: Record<string, PluginDefinition> = {
    "@liferpg/plugin-core-timer": {
        manifest: timerManifest as unknown as IPluginManifest,
        loader: () => import("@liferpg/plugin-core-timer"),
    },
};