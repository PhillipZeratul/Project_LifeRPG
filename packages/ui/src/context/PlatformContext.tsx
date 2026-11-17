import React, { createContext, useContext } from "react";
import type { IPlatformBridge } from "@liferpg/sdk";

const PlatformContext = createContext<IPlatformBridge | null>(null);

export const PlatformProvider: React.FC<{
    bridge: IPlatformBridge;
    children: React.ReactNode;
}> = ({ bridge, children }) => <PlatformContext.Provider value={bridge}> {children}</PlatformContext.Provider>;

export const usePlatform = (): IPlatformBridge => {
    const ctx = useContext(PlatformContext);
    if (!ctx) throw new Error("usePlatform must be used with PlatformProvider");
    return ctx;
};
