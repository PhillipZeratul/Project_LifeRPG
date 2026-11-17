import type { AvatarId, ProgressionEvent } from "@liferpg/sdk";

export interface IProgressionStore {
  append(event: ProgressionEvent): Promise<void> | void;
  getEvents(avatarId: AvatarId, since?: number): Promise<ProgressionEvent[]> | ProgressionEvent[];
}

export class PunitiveDeductionForbiddenError extends Error {
  public readonly code = "PUNITIVE_DEDUCTION_FORBIDDEN";
  constructor(message = "Progression is strictly additive; punitive deductions or non-positive amounts are forbidden per ADR-0001.") {
    super(message);
    this.name = "PunitiveDeductionForbiddenError";
  }
}

export class InMemoryProgressionStore implements IProgressionStore {
  private eventsByAvatar: Map<AvatarId, ProgressionEvent[]> = new Map();
  private eventIds: Set<string> = new Set();

  public append(event: ProgressionEvent): void {
    if (typeof event.amount !== "number" || !Number.isFinite(event.amount) || event.amount <= 0) {
      throw new PunitiveDeductionForbiddenError(
        `Progression is strictly additive: cannot record non-positive amount (${event.amount})`
      );
    }

    if (this.eventIds.has(event.id)) {
      // Event already recorded (idempotent ignore or append-only preservation)
      return;
    }

    const immutableEvent: ProgressionEvent = Object.freeze({ ...event });

    let avatarEvents = this.eventsByAvatar.get(event.avatarId);
    if (!avatarEvents) {
      avatarEvents = [];
      this.eventsByAvatar.set(event.avatarId, avatarEvents);
    }

    avatarEvents.push(immutableEvent);
    this.eventIds.add(event.id);
  }

  public getEvents(avatarId: AvatarId, since?: number): ProgressionEvent[] {
    const list = this.eventsByAvatar.get(avatarId) ?? [];
    if (since === undefined) {
      return [...list];
    }
    return list.filter((e) => e.timestamp >= since);
  }
}
