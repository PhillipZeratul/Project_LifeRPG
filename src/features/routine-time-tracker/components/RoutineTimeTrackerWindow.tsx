import { useState, useEffect } from "react";
import { emit } from "@tauri-apps/api/event";

export default function RoutineTimeTrackerWindow() {
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRunning && secondsLeft > 0) {
      interval = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, secondsLeft]);

  const finishSession = async () => {
    setIsRunning(false);
    setSecondsLeft(25 * 60);
    await emit("activity_completed", {
      type: "FOCUS",
      durationMinutes: 25,
      xpEarned: 50,
      timestamp: Date.now(),
    });
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4 select-none">
      <div className="text-5xl font-mono font-bold tracking-tight">
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </div>

      <div className="mt-6 flex gap-2">
        <button
          onClick={() => setIsRunning(!isRunning)}
          className="px-4 py-2 bg-amber-500 text-neutral-950 rounded font-bold text-sm hover:bg-amber-400 transition"
        >
          {isRunning ? "Pause" : "Start"}
        </button>
        <button
          onClick={finishSession}
          className="px-4 py-2 bg-neutral-800 text-neutral-200 rounded text-sm hover:bg-neutral-700 transition"
        >
          Complete
        </button>
      </div>
    </div>
  );
}
