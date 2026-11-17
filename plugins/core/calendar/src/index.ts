import {
    BasePlugin,
    CalendarEvents,
    type IPluginContext,
    type Routine,
    type ListRoutinesParams,
    type CreateCalendarOverrideParams,
    type UpdateCalendarOverrideParams,
    type GetCalendarOverrideParams,
    type ListCalendarOverridesParams,
    type DeleteCalendarOverrideParams,
    type GetDayTimelineParams,
    type GetTimelineRangeParams,
} from "@liferpg/sdk";
import { LocalCalendarStore, CalendarStoreError } from "./calendar-store";

export * from "./calendar-store";

export default class CalendarPlugin extends BasePlugin {
    private static defaultStore = new LocalCalendarStore();
    private store: LocalCalendarStore;
    private routineProvider?: (dayOfWeek?: number) => Promise<Routine[]> | Routine[];

    constructor(
        context: IPluginContext,
        store?: LocalCalendarStore,
        routineProvider?: (dayOfWeek?: number) => Promise<Routine[]> | Routine[],
    ) {
        super(context);
        this.store = store ?? CalendarPlugin.defaultStore;
        this.routineProvider = routineProvider;
    }

    public static resetDefaultStore(): void {
        CalendarPlugin.defaultStore = new LocalCalendarStore();
    }

    public static getDefaultStore(): LocalCalendarStore {
        return CalendarPlugin.defaultStore;
    }

    public getStore(): LocalCalendarStore {
        return this.store;
    }

    private async fetchRoutines(dayOfWeek?: number): Promise<Routine[]> {
        if (this.routineProvider) {
            return this.routineProvider(dayOfWeek);
        }

        if (this.context.callRpc) {
            try {
                const result = await this.context.callRpc<ListRoutinesParams | undefined, Routine[]>(
                    "routine.list",
                    dayOfWeek !== undefined ? { dayOfWeek } : undefined,
                );
                return result ?? [];
            } catch {
                // If routine plugin is disabled or error occurs, degrade gracefully
                return [];
            }
        }

        return [];
    }

    async onLoad(): Promise<void> {
        console.log(
            `[Plugin] Initializing ${this.manifest.displayName || this.manifest.name} ${this.manifest.version}`,
        );

        if (this.context.registerRpcHandler) {
            // Timeline queries
            this.context.registerRpcHandler<GetDayTimelineParams>(
                "calendar.getDayTimeline",
                async (params) => {
                    const routines = await this.fetchRoutines();
                    return this.store.getDayTimeline(params, routines);
                },
                { requiredPermissions: ["calendar:read"], serviceId: "calendar" },
            );

            this.context.registerRpcHandler<GetTimelineRangeParams>(
                "calendar.getTimelineRange",
                async (params) => {
                    return this.store.getTimelineRange(params, (dayOfWeek) => this.fetchRoutines(dayOfWeek));
                },
                { requiredPermissions: ["calendar:read"], serviceId: "calendar" },
            );

            // Overrides CRUD
            this.context.registerRpcHandler<CreateCalendarOverrideParams>(
                "calendar.createOverride",
                async (params) => {
                    const override = this.store.createOverride(params);
                    this.context.events.emit(CalendarEvents.OverrideCreated, override);
                    return override;
                },
                { requiredPermissions: ["calendar:write"], serviceId: "calendar" },
            );

            this.context.registerRpcHandler<GetCalendarOverrideParams>(
                "calendar.getOverride",
                async (params) => {
                    return this.store.getOverride(params.id);
                },
                { requiredPermissions: ["calendar:read"], serviceId: "calendar" },
            );

            this.context.registerRpcHandler<ListCalendarOverridesParams | undefined>(
                "calendar.listOverrides",
                async (params) => {
                    return this.store.listOverrides(params);
                },
                { requiredPermissions: ["calendar:read"], serviceId: "calendar" },
            );

            this.context.registerRpcHandler<UpdateCalendarOverrideParams>(
                "calendar.updateOverride",
                async (params) => {
                    const updated = this.store.updateOverride(params);
                    this.context.events.emit(CalendarEvents.OverrideUpdated, updated);
                    return updated;
                },
                { requiredPermissions: ["calendar:write"], serviceId: "calendar" },
            );

            this.context.registerRpcHandler<DeleteCalendarOverrideParams>(
                "calendar.deleteOverride",
                async (params) => {
                    const existing = this.store.getOverride(params.id);
                    const result = this.store.deleteOverride(params);
                    this.context.events.emit(CalendarEvents.OverrideDeleted, {
                        id: params.id,
                        override: existing,
                    });
                    return result;
                },
                { requiredPermissions: ["calendar:write"], serviceId: "calendar" },
            );
        }
    }

    async onUnload(): Promise<void> {
        console.log(`[Plugin] Unloaded ${this.manifest.displayName || this.manifest.name} ${this.manifest.version}`);
    }
}

export { CalendarStoreError };
