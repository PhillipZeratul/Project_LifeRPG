import FocusTimerPlugin, { FocusTimerServiceToken, TimerEvents } from "@liferpg/plugin-core-timer";
import { CentralEventBus } from "./central-event-bus";
import { CentralServiceRegistry } from "./central-service-registry";
import { PluginManager } from "./plugin-manager";

const bus = new CentralEventBus();
const registry = new CentralServiceRegistry();
const manager = new PluginManager(bus, registry);

export async function bootstrap() {
    bus.on(TimerEvents.Finished, (event) => {
        console.log(`[Central] Timer finished! +${event.durationSeconds * 2} EXP rewarded.`);
    });

    await manager.loadPlugin(FocusTimerPlugin, {
        id: "focus-timer",
        name: "Focus Timer",
        version: "1.0.0",
        author: "Phillix",
        description: "A test timer plugin",
    });

    bus.emit(TimerEvents.Start, { durationSeconds: 25 * 60 });

    const timer = registry.get(FocusTimerServiceToken);
    console.log("[Central] Is timer active?", timer?.isTimerRunning());
}
