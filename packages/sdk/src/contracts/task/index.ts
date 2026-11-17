import type { IEventDefinition } from "../../types";
import type { Task, TaskCompletionEvent, TaskScheduleEvent } from "./types";

export * from "./types";
export * from "./schemas";

export function defineTaskEvent<T = void>(name: string): IEventDefinition<T> & { readonly type: string } {
    const event = {
        type: name,
        toString() {
            return name;
        },
        valueOf() {
            return name;
        },
    };
    return event as unknown as IEventDefinition<T> & { readonly type: string };
}

export const TaskEvents = {
    Created: defineTaskEvent<Task>("task:created"),
    Updated: defineTaskEvent<Task>("task:updated"),
    Deleted: defineTaskEvent<{ id: string; task: Task }>("task:deleted"),
    Completed: defineTaskEvent<TaskCompletionEvent>("task:completed"),
    Scheduled: defineTaskEvent<TaskScheduleEvent>("task:scheduled"),
} as const;
