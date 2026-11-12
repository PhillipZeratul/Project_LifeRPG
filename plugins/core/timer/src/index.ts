import { BasePlugin, defineEvent } from "@liferpg/sdk";

export interface FocusTimerService {
    getActiveSessionDuration(): number;
    isTimerRunning(): boolean;
}

export const TimerEvents = {
    Start: defineEvent<{ durationSeconds: number }>("timer:start"),
    Tick: defineEvent<{ durationSeconds: number }>("timer:tick"),
    Finished: defineEvent<{ durationSeconds: number }>("timer:finished"),
} as const;

export default class FocusTimerPlugin extends BasePlugin {
    private timerActive = false;
    private timerInterval: ReturnType<typeof setInterval> | null = null;
    private currentDuration = 0;

    async onLoad() {
        console.log(`[Plugin] Initializing ${this.manifest.displayName || this.manifest.name} ${this.manifest.version}`);

        this.context.events.on(TimerEvents.Start, (payload) => {
            this.startTimer(payload.durationSeconds);
        });
    }

    async onUnload() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.timerActive = false;
        console.log(`[Plugin] Unloaded ${this.manifest.displayName || this.manifest.name} ${this.manifest.version}`);
    }

    public startTimer(durationSeconds: number) {
        if (this.timerActive) {
            console.log('Timer is already active');
            return;
        }
        console.log(`Starting timer for ${durationSeconds} seconds`);

        this.timerActive = true;
        this.currentDuration = durationSeconds;

        this.timerInterval = setInterval(() => {
            this.currentDuration -= 1000;
            if (this.currentDuration <= 0) {
                this.stopTimer();
                this.context.events.emit(TimerEvents.Finished, { durationSeconds: durationSeconds });
            } else {
                this.context.events.emit(TimerEvents.Tick, { durationSeconds: this.currentDuration });
            }
        });
    }

    public stopTimer() {
        if (this.timerInterval !== null) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.timerActive = false;
    }
}
