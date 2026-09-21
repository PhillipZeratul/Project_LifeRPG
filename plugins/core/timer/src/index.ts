import { BasePlugin } from "@liferpg/sdk";

export interface FocusTimerService {
    getActiveSessionDuration(): number;
    isTimerRunning(): boolean;
}

export default class FocusTimerPlugin extends BasePlugin {
    private timerActive = false;
    private currentDuration = 0;

    async onLoad() {
        this.context.services.register<FocusTimerService>("focus-timer-service", {
            getActiveSessionDuration: () => this.currentDuration,
            isTimerRunning: () => this.timerActive,
        });

        this.context.events.on("timer:cmd-start", (payload: { durationMinutes: number }) => {
            this.startSprint(payload.durationMinutes);
        });
    }

    async onUnload() {
        this.context.services.unregister("focus-timer-service");
    }

    public startSprint(durationMinutes: number) {
        this.timerActive = true;
        this.currentDuration = durationMinutes * 60 * 1000;

        this.context.events.emit("timer:started", { duration: this.currentDuration });

        const timer = setInterval(() => {
            this.currentDuration -= 1000;
            if (this.currentDuration <= 0) {
                this.timerActive = false;
                clearInterval(timer);
                this.context.events.emit("timer:finished", { duration: durationMinutes });
            } else {
                this.context.events.emit("timer:tick", { duration: this.currentDuration });
            }
        });
    }
}
