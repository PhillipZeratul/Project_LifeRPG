import {
    BasePlugin,
    HabitEvents,
    type CreateHabitParams,
    type UpdateHabitParams,
    type GetHabitParams,
    type ListHabitsParams,
    type DeleteHabitParams,
    type TrackHabitParams,
    type GetHabitCompletionsParams,
    type GetHabitStreakParams,
    type IPluginContext,
} from "@liferpg/sdk";
import { LocalHabitStore, HabitStoreError } from "./habit-store";

export * from "./habit-store";

export default class HabitPlugin extends BasePlugin {
    private static defaultStore = new LocalHabitStore();
    private store: LocalHabitStore;

    constructor(context: IPluginContext, store?: LocalHabitStore) {
        super(context);
        this.store = store ?? HabitPlugin.defaultStore;
    }

    public static resetDefaultStore(): void {
        HabitPlugin.defaultStore = new LocalHabitStore();
    }

    public getStore(): LocalHabitStore {
        return this.store;
    }

    async onLoad(): Promise<void> {
        console.log(`[Plugin] Initializing ${this.manifest.displayName || this.manifest.name} ${this.manifest.version}`);

        if (this.context.registerRpcHandler) {
            // Write methods: require habits:write
            this.context.registerRpcHandler<CreateHabitParams>(
                "habit.create",
                async (params) => {
                    const habit = this.store.createHabit(params);
                    this.context.events.emit(HabitEvents.Created, habit);
                    return habit;
                },
                { requiredPermissions: ["habits:write"], serviceId: "habit" }
            );

            this.context.registerRpcHandler<UpdateHabitParams>(
                "habit.update",
                async (params) => {
                    const updated = this.store.updateHabit(params);
                    this.context.events.emit(HabitEvents.Updated, updated);
                    return updated;
                },
                { requiredPermissions: ["habits:write"], serviceId: "habit" }
            );

            this.context.registerRpcHandler<DeleteHabitParams>(
                "habit.delete",
                async (params) => {
                    const existing = this.store.getHabit(params.id);
                    const result = this.store.deleteHabit(params);
                    this.context.events.emit(HabitEvents.Deleted, { id: params.id, habit: existing });
                    return result;
                },
                { requiredPermissions: ["habits:write"], serviceId: "habit" }
            );

            // Read methods: require habits:read
            this.context.registerRpcHandler<GetHabitParams>(
                "habit.get",
                async (params) => {
                    return this.store.getHabit(params.id);
                },
                { requiredPermissions: ["habits:read"], serviceId: "habit" }
            );

            this.context.registerRpcHandler<ListHabitsParams | undefined>(
                "habit.list",
                async (params) => {
                    return this.store.listHabits(params);
                },
                { requiredPermissions: ["habits:read"], serviceId: "habit" }
            );

            this.context.registerRpcHandler<GetHabitCompletionsParams | undefined>(
                "habit.getCompletions",
                async (params) => {
                    return this.store.getCompletions(params);
                },
                { requiredPermissions: ["habits:read"], serviceId: "habit" }
            );

            this.context.registerRpcHandler<GetHabitStreakParams>(
                "habit.getStreak",
                async (params) => {
                    return this.store.getStreak(params);
                },
                { requiredPermissions: ["habits:read"], serviceId: "habit" }
            );

            // Tracking methods: require habits:track
            const handleTrack = async (params: TrackHabitParams) => {
                const result = this.store.trackHabit(params);
                this.context.events.emit(HabitEvents.Completed, {
                    habit: result.habit,
                    completion: result.completion,
                    xpAwarded: result.xpAwarded,
                    statId: result.completion.statId,
                    avatarId: result.completion.avatarId,
                });
                return result;
            };

            this.context.registerRpcHandler<TrackHabitParams>(
                "habit.track",
                handleTrack,
                { requiredPermissions: ["habits:track"], serviceId: "habit" }
            );

            this.context.registerRpcHandler<TrackHabitParams>(
                "habit.complete",
                handleTrack,
                { requiredPermissions: ["habits:track"], serviceId: "habit" }
            );
        }
    }

    async onUnload(): Promise<void> {
        console.log(`[Plugin] Unloaded ${this.manifest.displayName || this.manifest.name} ${this.manifest.version}`);
    }
}

export { HabitStoreError };
