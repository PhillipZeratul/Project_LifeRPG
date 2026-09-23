import { TimerEvents } from "@liferpg/plugin-core-timer";
import { CentralEventBus } from "./central-event-bus";
import { PluginManager } from "./plugin-manager";

const bus = new CentralEventBus();
const manager = new PluginManager(bus);

export async function bootstrap() {
    await manager.loadPlugin("@liferpg/plugin-core-timer");

    bus.on(TimerEvents.Finished, (event) => {
        console.log(`[Central] Timer finished! +${event.durationSeconds * 2} EXP rewarded.`);
    });

    bus.emit(TimerEvents.Start, { durationSeconds: 25 * 60 });

}
