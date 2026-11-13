import React from "react";
import ReactDOM from "react-dom/client";
import { App, PlatformProvider } from "@liferpg/ui";
import { CapacitorPlatformBridge } from "./platform/capacitor-bridge";
import "@liferpg/ui/styles.css";

const bridge = new CapacitorPlatformBridge();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <PlatformProvider bridge={bridge}>
            <App />
        </PlatformProvider>
    </React.StrictMode>,
);
