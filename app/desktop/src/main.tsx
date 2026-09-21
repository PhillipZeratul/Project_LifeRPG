import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { bootstrap } from "@liferpg/host-runtime";

async function init() {
    await bootstrap();

    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>,
    );
}

init().catch((err) => {
    console.error("Failed to bootstrap:", err);
});
