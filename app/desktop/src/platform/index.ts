import { ElectronPlatformBridge } from "./electron-bridge";
import { CapacitorPlatformBridge } from "./capacitor-bridge";
import type { IPlatformBridge } from "@liferpg/sdk";

export const platform: IPlatformBridge =
    typeof window !== "undefined" && "electron" in window ?
        new ElectronPlatformBridge()
    :   new CapacitorPlatformBridge();
