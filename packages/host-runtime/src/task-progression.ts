import { TaskEvents, type IEventBus } from "@liferpg/sdk";
import type { AvatarService } from "./avatar-service";

/**
 * Connects Task completion events on CentralEventBus to AvatarService,
 * awarding strictly additive Experience (XP) on the Avatar progression engine without penalty.
 */
export function wireTaskProgressionIntegration(
    eventBus: IEventBus,
    avatarService: AvatarService
): () => void {
    return eventBus.on(TaskEvents.Completed, async (event) => {
        try {
            await avatarService.recordProgressionEvent({
                avatarId: event.avatarId || "default",
                amount: event.xpAwarded,
                statId: event.statId,
                type: event.statId ? "stat_xp_gained" : "xp_gained",
                source: {
                    type: "task",
                    id: event.task.id,
                    metadata: {
                        taskTitle: event.task.title,
                        timeBlockId: event.task.timeBlockId,
                        notes: event.notes,
                    },
                },
            });
        } catch (error) {
            console.error("[HostRuntime] Failed to record progression event for task completion:", error);
        }
    });
}
