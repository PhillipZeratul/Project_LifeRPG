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
    private currentDuration = 0;

    async onLoad() {
        console.log(`[Plugin] Initializing ${this.manifest.name} ${this.manifest.version}`);

        this.context.events.on(TimerEvents.Start, (payload) => {
            this.startSprint(payload.durationSeconds);
        });
    }

    async onUnload() {}

    public startSprint(durationSeconds: number) {
        if (this.timerActive) {
            console.log('Timer is already active');
            return;
        }
        console.log(`Starting sprint for ${durationSeconds} seconds`);

        this.timerActive = true;
        this.currentDuration = durationSeconds;

        const timer = setInterval(() => {
            this.currentDuration -= 1000;
            if (this.currentDuration <= 0) {
                this.timerActive = false;
                clearInterval(timer);
                this.context.events.emit(TimerEvents.Finished, { durationSeconds: durationSeconds });
            } else {
                this.context.events.emit(TimerEvents.Tick, { durationSeconds: this.currentDuration });
            }
        });
    }
}
