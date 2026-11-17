import { HabitEvents, type IEventBus } from "@liferpg/sdk";
import type { AvatarService } from "./avatar-service";

/**
 * Connects Habit completion events on CentralEventBus to AvatarService,
 * awarding additive Experience (XP) on the Avatar progression engine.
 */
export function wireHabitProgressionIntegration(eventBus: IEventBus, avatarService: AvatarService): () => void {
    return eventBus.on(HabitEvents.Completed, async (event) => {
        try {
            await avatarService.recordProgressionEvent({
                avatarId: event.avatarId || "default",
                amount: event.xpAwarded,
                statId: event.statId,
                type: event.statId ? "stat_xp_gained" : "xp_gained",
                source: {
                    type: "habit",
                    id: event.habit.id,
                    metadata: {
                        completionId: event.completion.id,
                        habitName: event.habit.name,
                        timeBlockId: event.habit.timeBlockId,
                        notes: event.completion.notes,
                    },
                },
            });
        } catch (error) {
            console.error("[HostRuntime] Failed to record progression event for habit completion:", error);
        }
    });
}
