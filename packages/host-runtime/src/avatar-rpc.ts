import type {
    AvatarGetParams,
    AvatarGetResult,
    AvatarRecordEventParams,
    AvatarRecordEventResult,
    AvatarGetEventsParams,
    AvatarGetEventsResult,
} from "@liferpg/sdk";
import type { HostRpcBridge } from "./rpc-bridge";
import type { AvatarService } from "./avatar-service";

export function registerAvatarRpcHandlers(bridge: HostRpcBridge, avatarService: AvatarService): void {
    bridge.registerHandler<AvatarGetParams, AvatarGetResult>("avatar.get", async (params) => {
        return avatarService.getAvatar(params.avatarId);
    });

    bridge.registerHandler<AvatarRecordEventParams, AvatarRecordEventResult>(
        "avatar.recordProgressionEvent",
        async (params) => {
            return avatarService.recordProgressionEvent(params);
        },
    );

    bridge.registerHandler<AvatarGetEventsParams, AvatarGetEventsResult>("avatar.getEvents", async (params) => {
        return avatarService.getEvents(params);
    });
}
