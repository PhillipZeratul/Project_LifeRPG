import FocusTimerPlugin, { FocusTimerService} from "@liferpg/plugins/core/timer";
import { CentralEventBus } from "./central-event-bus";
import { CentralServiceRegistry } from "./central-service-registry";
import { PluginManager } from "./plugin-manager";

const bus = new CentralEventBus();
const registry = new CentralServiceRegistry();
const manager = new PluginManager(bus, registry);

async function bootstrap() {
    bus.on("timer:finished", (event: { duration: number }) => {
        console.log(`[Central] Timer finished! +${event.duration * 2} EXP rewarded.`);
    });

    await manager.loadPlugin(FocusTimerPlugin, {
        id: "focus-timer",
        name: "Focus Timer",
        version: "1.0.0",
        author: "Phillix",
        description: "A test timer plugin",
    });

    bus.emit('timer:cmd-start', { durationMinutes: 25});

    const timer = registry.get<FocusTimerService>('focus-timer-service');
    console.log('[Central] Is timer active?', timer?.isTimerRunning());
}