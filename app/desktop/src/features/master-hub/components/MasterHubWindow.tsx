import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

interface ActivityPayload {
  type: string;
  durationMinutes: number;
  xpEarned: number;
}

export default function MasterHubWindow() {
  const [, setXp] = useState(0);

  useEffect(() => {
    const unlisten = listen<ActivityPayload>("activity_completed", (event) => {
      setXp((prev) => prev + event.payload.xpEarned);
    });

    return () => {
      unlisten.then((unlisten) => unlisten());
    };
  }, []);

  const spawnWindow = async (view: string) => {
    try {
      await invoke("open_view", { viewName: view });
    } catch (error) {
      console.error("Error opening window:", error);
    }
  };

  return (
    <div className="flex h-screen bg-neutral-900 text-white">
      {/* Left Sidebar */}
      <aside className="w-64 border-r border-neutral-800 p-6 flex flex-col justify-between">
        <div>
          <h1 className="text-xl font-bold traching-wider text-amber-400">
            LIFERPG
          </h1>
          <p className="text-xs text-neutral-400 mt-1">Master Hub</p>

          <div className="mt-8 space-y-3">
            <button
              className="w-full text-left px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm font-medium transition"
              onClick={() => spawnWindow("routine-time-tracker")}
            >
              Open Routine Time Tracker
            </button>
            <button
              className="w-full text-left px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm font-medium transition"
              onClick={() => spawnWindow("routine-time-tracker")}
            >
              Test Button
            </button>
          </div>
        </div>

        <div className="text-xs text-neutral-500">System Core Online</div>
      </aside>

      {/* Main Diorama Center Area */}
      <main className="flex-1 flex flex-col items-center justify-center relative">
        <div className="w-32 h-32 rounded-full border-4 border-amber400/50 flex items-center justify-center bg-neutral-800 shadow-xl shadow-amber-500/10 animate-pulse">
          <span className="text-4xl">🧙‍♂️</span>
        </div>
        <h2 className="mt-4 text-lg font-semibold">Avatar Presence</h2>
        <p className="text-sm text-neutral-400">
          Awaiting activity signals from plugins...
        </p>
      </main>
    </div>
  );
}
