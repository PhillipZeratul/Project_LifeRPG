import {
    BasePlugin,
    RoutineEvents,
    type CreateRoutineParams,
    type UpdateRoutineParams,
    type GetRoutineParams,
    type ListRoutinesParams,
    type DeleteRoutineParams,
    type CreateTimeBlockParams,
    type UpdateTimeBlockParams,
    type GetTimeBlockParams,
    type ListTimeBlocksParams,
    type DeleteTimeBlockParams,
    type IPluginContext,
} from "@liferpg/sdk";
import { LocalRoutineStore, RoutineStoreError } from "./routine-store";

export * from "./routine-store";

export default class RoutinePlugin extends BasePlugin {
    private static defaultStore = new LocalRoutineStore();
    private store: LocalRoutineStore;

    constructor(context: IPluginContext, store?: LocalRoutineStore) {
        super(context);
        this.store = store ?? RoutinePlugin.defaultStore;
    }

    public static resetDefaultStore(): void {
        RoutinePlugin.defaultStore = new LocalRoutineStore();
    }

    public static getDefaultStore(): LocalRoutineStore {
        return RoutinePlugin.defaultStore;
    }

    public getStore(): LocalRoutineStore {
        return this.store;
    }

    async onLoad(): Promise<void> {
        console.log(
            `[Plugin] Initializing ${this.manifest.displayName || this.manifest.name} ${this.manifest.version}`,
        );

        if (this.context.registerRpcHandler) {
            // Routine CRUD
            this.context.registerRpcHandler<CreateRoutineParams>(
                "routine.create",
                async (params) => {
                    const routine = this.store.createRoutine(params);
                    this.context.events.emit(RoutineEvents.Created, routine);
                    return routine;
                },
                { requiredPermissions: ["routines:write"], serviceId: "routine" },
            );

            this.context.registerRpcHandler<GetRoutineParams>(
                "routine.get",
                async (params) => {
                    return this.store.getRoutine(params.id);
                },
                { requiredPermissions: ["routines:read"], serviceId: "routine" },
            );

            this.context.registerRpcHandler<ListRoutinesParams | undefined>(
                "routine.list",
                async (params) => {
                    return this.store.listRoutines(params);
                },
                { requiredPermissions: ["routines:read"], serviceId: "routine" },
            );

            this.context.registerRpcHandler<UpdateRoutineParams>(
                "routine.update",
                async (params) => {
                    const updated = this.store.updateRoutine(params);
                    this.context.events.emit(RoutineEvents.Updated, updated);
                    return updated;
                },
                { requiredPermissions: ["routines:write"], serviceId: "routine" },
            );

            this.context.registerRpcHandler<DeleteRoutineParams>(
                "routine.delete",
                async (params) => {
                    const existing = this.store.getRoutine(params.id);
                    const result = this.store.deleteRoutine(params);
                    this.context.events.emit(RoutineEvents.Deleted, { id: params.id, routine: existing });
                    return result;
                },
                { requiredPermissions: ["routines:write"], serviceId: "routine" },
            );

            // Time Block CRUD
            this.context.registerRpcHandler<CreateTimeBlockParams>(
                "routine.createTimeBlock",
                async (params) => {
                    const timeBlock = this.store.createTimeBlock(params);
                    this.context.events.emit(RoutineEvents.TimeBlockCreated, timeBlock);
                    return timeBlock;
                },
                { requiredPermissions: ["routines:write"], serviceId: "routine" },
            );

            this.context.registerRpcHandler<GetTimeBlockParams>(
                "routine.getTimeBlock",
                async (params) => {
                    return this.store.getTimeBlock(params.id);
                },
                { requiredPermissions: ["routines:read"], serviceId: "routine" },
            );

            this.context.registerRpcHandler<ListTimeBlocksParams | undefined>(
                "routine.listTimeBlocks",
                async (params) => {
                    return this.store.listTimeBlocks(params);
                },
                { requiredPermissions: ["routines:read"], serviceId: "routine" },
            );

            this.context.registerRpcHandler<UpdateTimeBlockParams>(
                "routine.updateTimeBlock",
                async (params) => {
                    const updated = this.store.updateTimeBlock(params);
                    this.context.events.emit(RoutineEvents.TimeBlockUpdated, updated);
                    return updated;
                },
                { requiredPermissions: ["routines:write"], serviceId: "routine" },
            );

            this.context.registerRpcHandler<DeleteTimeBlockParams>(
                "routine.deleteTimeBlock",
                async (params) => {
                    const existing = this.store.getTimeBlock(params.id);
                    const result = this.store.deleteTimeBlock(params);
                    this.context.events.emit(RoutineEvents.TimeBlockDeleted, {
                        id: params.id,
                        routineId: existing.routineId,
                        timeBlock: existing,
                    });
                    return result;
                },
                { requiredPermissions: ["routines:write"], serviceId: "routine" },
            );
        }
    }

    async onUnload(): Promise<void> {
        console.log(`[Plugin] Unloaded ${this.manifest.displayName || this.manifest.name} ${this.manifest.version}`);
    }
}
export { RoutineStoreError };
