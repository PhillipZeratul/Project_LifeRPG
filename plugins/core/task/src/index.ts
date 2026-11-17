import {
    BasePlugin,
    TaskEvents,
    type CreateTaskParams,
    type UpdateTaskParams,
    type GetTaskParams,
    type ListTasksParams,
    type DeleteTaskParams,
    type ScheduleTaskParams,
    type CompleteTaskParams,
    type IPluginContext,
} from "@liferpg/sdk";
import { LocalTaskStore, TaskStoreError } from "./task-store";

export * from "./task-store";

export default class TaskPlugin extends BasePlugin {
    private static defaultStore = new LocalTaskStore();
    private store: LocalTaskStore;

    constructor(context: IPluginContext, store?: LocalTaskStore) {
        super(context);
        this.store = store ?? TaskPlugin.defaultStore;
    }

    public static resetDefaultStore(): void {
        TaskPlugin.defaultStore = new LocalTaskStore();
    }

    public getStore(): LocalTaskStore {
        return this.store;
    }

    async onLoad(): Promise<void> {
        console.log(`[Plugin] Initializing ${this.manifest.displayName || this.manifest.name} ${this.manifest.version}`);

        if (this.context.registerRpcHandler) {
            // Write methods: require tasks:write
            this.context.registerRpcHandler<CreateTaskParams>(
                "task.create",
                async (params) => {
                    const task = this.store.createTask(params);
                    this.context.events.emit(TaskEvents.Created, task);
                    return task;
                },
                { requiredPermissions: ["tasks:write"], serviceId: "task" }
            );

            this.context.registerRpcHandler<UpdateTaskParams>(
                "task.update",
                async (params) => {
                    const updated = this.store.updateTask(params);
                    this.context.events.emit(TaskEvents.Updated, updated);
                    return updated;
                },
                { requiredPermissions: ["tasks:write"], serviceId: "task" }
            );

            this.context.registerRpcHandler<DeleteTaskParams>(
                "task.delete",
                async (params) => {
                    const existing = this.store.getTask(params.id);
                    const result = this.store.deleteTask(params);
                    this.context.events.emit(TaskEvents.Deleted, { id: params.id, task: existing });
                    return result;
                },
                { requiredPermissions: ["tasks:write"], serviceId: "task" }
            );

            this.context.registerRpcHandler<ScheduleTaskParams>(
                "task.schedule",
                async (params) => {
                    const existing = this.store.getTask(params.id);
                    const previousSchedule = existing.schedule;
                    const scheduled = this.store.scheduleTask(params);
                    this.context.events.emit(TaskEvents.Scheduled, {
                        task: scheduled,
                        previousSchedule,
                    });
                    return scheduled;
                },
                { requiredPermissions: ["tasks:write"], serviceId: "task" }
            );

            this.context.registerRpcHandler<CompleteTaskParams>(
                "task.complete",
                async (params) => {
                    const result = this.store.completeTask(params);
                    if (result.xpAwarded > 0) {
                        this.context.events.emit(TaskEvents.Completed, {
                            task: result.task,
                            xpAwarded: result.xpAwarded,
                            statId: result.task.statId,
                            avatarId: result.avatarId,
                            notes: params.notes,
                        });
                    }
                    return result;
                },
                { requiredPermissions: ["tasks:write"], serviceId: "task" }
            );

            // Read methods: require tasks:read
            this.context.registerRpcHandler<GetTaskParams>(
                "task.get",
                async (params) => {
                    return this.store.getTask(params.id);
                },
                { requiredPermissions: ["tasks:read"], serviceId: "task" }
            );

            this.context.registerRpcHandler<ListTasksParams | undefined>(
                "task.list",
                async (params) => {
                    return this.store.listTasks(params);
                },
                { requiredPermissions: ["tasks:read"], serviceId: "task" }
            );
        }
    }

    async onUnload(): Promise<void> {
        console.log(`[Plugin] Unloaded ${this.manifest.displayName || this.manifest.name} ${this.manifest.version}`);
    }
}

export { TaskStoreError };
