import { TimerEvents } from "@liferpg/plugin-core-timer";
import { CentralEventBus } from "./central-event-bus";
import { PluginManager } from "./plugin-manager";

export * from "./rpc-bridge";
export * from "./progression-store";
export * from "./avatar-service";
export * from "./avatar-rpc";
export * from "./central-service-registry";
export { CentralEventBus } from "./central-event-bus";
export { PluginManager } from "./plugin-manager";
export { ScopedPluginContext } from "./scoped-plugin-context";
export { LocalRoutineStore, RoutineStoreError, default as RoutinePlugin } from "@liferpg/plugin-core-routine";
export { LocalHabitStore, HabitStoreError, default as HabitPlugin } from "@liferpg/plugin-core-habit";
export { LocalTaskStore, TaskStoreError, default as TaskPlugin } from "@liferpg/plugin-core-task";
export { wireHabitProgressionIntegration } from "./habit-progression";
export { wireTaskProgressionIntegration } from "./task-progression";

const bus = new CentralEventBus();
const manager = new PluginManager(bus);

export async function bootstrap() {
    // Temporary code.
    await manager.enablePlugin("@liferpg/plugin-core-timer");

    bus.on(TimerEvents.Finished, (event) => {
        console.log(`[Central] Timer finished! +${event.durationSeconds * 2} EXP rewarded.`);
    });

    bus.emit(TimerEvents.Start, { durationSeconds: 25 * 60 });
}
