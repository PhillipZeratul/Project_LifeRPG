import {
  type Avatar,
  type AvatarId,
  type AvatarRecordEventParams,
  type AvatarRecordEventResult,
  type AvatarGetEventsParams,
  type AvatarGetEventsResult,
  type AvatarState,
  type ProgressionEvent,
  calculateAvatarProgression,
} from "@liferpg/sdk";
import type { IProgressionStore } from "./progression-store";

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "evt-" + Math.random().toString(36).substring(2, 11) + "-" + Date.now().toString(36);
}

export class AvatarService {
  private avatars: Map<AvatarId, Avatar> = new Map();

  constructor(private readonly progressionStore: IProgressionStore) {}

  public getOrCreateAvatar(avatarId: AvatarId, name = "Avatar"): Avatar {
    let avatar = this.avatars.get(avatarId);
    if (!avatar) {
      avatar = {
        id: avatarId,
        name,
        createdAt: Date.now(),
      };
      this.avatars.set(avatarId, avatar);
    }
    return avatar;
  }

  public async getAvatar(avatarId: AvatarId): Promise<AvatarState> {
    const avatar = this.getOrCreateAvatar(avatarId);
    const events = await this.progressionStore.getEvents(avatarId);
    const progression = calculateAvatarProgression(events);

    return {
      avatar,
      progression,
    };
  }

  public async recordProgressionEvent(
    params: AvatarRecordEventParams
  ): Promise<AvatarRecordEventResult> {
    const event: ProgressionEvent = {
      id: generateUUID(),
      avatarId: params.avatarId,
      type: params.type ?? (params.statId ? "stat_xp_gained" : "xp_gained"),
      amount: params.amount,
      statId: params.statId,
      source: params.source,
      timestamp: Date.now(),
    };

    await this.progressionStore.append(event);

    const state = await this.getAvatar(params.avatarId);
    return {
      event,
      progression: state.progression,
    };
  }

  public async getEvents(params: AvatarGetEventsParams): Promise<AvatarGetEventsResult> {
    const events = await this.progressionStore.getEvents(params.avatarId, params.since);
    return {
      events,
    };
  }
}
