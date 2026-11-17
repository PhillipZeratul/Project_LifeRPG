import { __brand } from "../../types";

export type AvatarId = string & { readonly [__brand]?: "AvatarId" };
export type StatId = string & { readonly [__brand]?: "StatId" };

export interface Avatar {
    id: AvatarId;
    name: string;
    createdAt: number;
}

export interface ProgressionCalculation {
    level: number;
    currentXp: number;
    nextLevelXp: number;
    totalXp: number;
}

export interface StatProgression extends ProgressionCalculation {
    statId: StatId;
}

export interface AvatarProgression extends ProgressionCalculation {
    stats: Record<StatId, StatProgression>;
}

export type ProgressionEventType = "xp_gained" | "stat_xp_gained" | string;

export interface ProgressionSource {
    type: string;
    id?: string;
    metadata?: Record<string, unknown>;
}

export interface ProgressionEvent {
    id: string;
    avatarId: AvatarId;
    type: ProgressionEventType;
    amount: number;
    statId?: StatId;
    source?: ProgressionSource;
    timestamp: number;
}

export interface AvatarState {
    avatar: Avatar;
    progression: AvatarProgression;
}

export interface AvatarGetParams {
    avatarId: AvatarId;
}

export interface AvatarGetResult {
    avatar: Avatar;
    progression: AvatarProgression;
}

export interface AvatarRecordEventParams {
    avatarId: AvatarId;
    amount: number;
    statId?: StatId;
    type?: ProgressionEventType;
    source?: ProgressionSource;
}

export interface AvatarRecordEventResult {
    event: ProgressionEvent;
    progression: AvatarProgression;
}

export interface AvatarGetEventsParams {
    avatarId: AvatarId;
    since?: number;
}

export interface AvatarGetEventsResult {
    events: ProgressionEvent[];
}
