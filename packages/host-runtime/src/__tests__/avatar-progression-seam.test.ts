import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  RpcClient,
  createMessageChannelTransportPair,
  type AvatarGetResult,
  type AvatarRecordEventResult,
  type AvatarGetEventsResult,
} from "@liferpg/sdk";
import {
  HostRpcBridge,
  AvatarService,
  InMemoryProgressionStore,
  registerAvatarRpcHandlers,
} from "../index";

describe("Avatar & Additive Progression Engine Seam (RPC Bridge)", () => {
  let bridge: HostRpcBridge;
  let client: RpcClient;
  let cleanup: () => void;
  let avatarService: AvatarService;
  let store: InMemoryProgressionStore;

  beforeEach(() => {
    bridge = new HostRpcBridge();
    store = new InMemoryProgressionStore();
    avatarService = new AvatarService(store);
    registerAvatarRpcHandlers(bridge, avatarService);

    const [hostTransport, clientTransport] = createMessageChannelTransportPair();
    const disconnect = bridge.connect(hostTransport);
    client = new RpcClient(clientTransport);

    cleanup = () => {
      client.dispose();
      disconnect();
    };
  });

  afterEach(() => {
    cleanup();
  });

  it("queries initial avatar progression state at Level 1 with 0 XP", async () => {
    const avatarId = "test-avatar-1";
    // Initialize or query avatar
    const result = await client.call<AvatarGetResult>("avatar.get", {
      avatarId,
    });

    expect(result.avatar.id).toBe(avatarId);
    expect(result.progression).toEqual({
      level: 1,
      currentXp: 0,
      nextLevelXp: 100,
      totalXp: 0,
      stats: {},
    });
  });

  it("appends progression events and deterministically levels up Avatar and Stats", async () => {
    const avatarId = "test-avatar-2";

    // Record 50 XP in Focus stat (Habit completed)
    const res1 = await client.call<AvatarRecordEventResult>("avatar.recordProgressionEvent", {
      avatarId,
      amount: 50,
      statId: "focus",
      type: "stat_xp_gained",
      source: { type: "habit", id: "habit-meditation" },
    });

    expect(res1.event.amount).toBe(50);
    expect(res1.event.statId).toBe("focus");
    expect(res1.progression.totalXp).toBe(50);
    expect(res1.progression.level).toBe(1);
    expect(res1.progression.stats["focus"]).toEqual({
      statId: "focus",
      level: 1,
      currentXp: 50,
      nextLevelXp: 100,
      totalXp: 50,
    });

    // Record another 75 XP in Focus stat -> total Focus XP = 125 -> Level 2 Focus!
    const res2 = await client.call<AvatarRecordEventResult>("avatar.recordProgressionEvent", {
      avatarId,
      amount: 75,
      statId: "focus",
      type: "stat_xp_gained",
      source: { type: "task", id: "deep-work-block" },
    });

    expect(res2.progression.totalXp).toBe(125);
    expect(res2.progression.level).toBe(2); // 125 >= 100
    expect(res2.progression.currentXp).toBe(25);
    expect(res2.progression.stats["focus"]).toEqual({
      statId: "focus",
      level: 2,
      currentXp: 25,
      nextLevelXp: 200,
      totalXp: 125,
    });

    // Query via avatar.get to verify client receives identical calculated progression state
    const fetched = await client.call<AvatarGetResult>("avatar.get", {
      avatarId,
    });

    expect(fetched.progression).toEqual(res2.progression);
  });

  it("strictly enforces additive progression and rejects punitive deductions (ADR-0001)", async () => {
    const avatarId = "test-avatar-3";

    // Attempt negative XP deduction
    await expect(
      client.call("avatar.recordProgressionEvent", {
        avatarId,
        amount: -20,
        statId: "vitality",
      })
    ).rejects.toMatchObject({
      name: "RpcError",
      code: "PUNITIVE_DEDUCTION_FORBIDDEN",
      message: expect.stringContaining("additive"),
    });

    // Attempt zero XP
    await expect(
      client.call("avatar.recordProgressionEvent", {
        avatarId,
        amount: 0,
        statId: "vitality",
      })
    ).rejects.toMatchObject({
      name: "RpcError",
      code: "PUNITIVE_DEDUCTION_FORBIDDEN",
    });

    // Verify state remained untouched at 0 XP
    const state = await client.call<AvatarGetResult>("avatar.get", {
      avatarId,
    });
    expect(state.progression.totalXp).toBe(0);
  });

  it("preserves append-only event stream history for sync reconciliation per ADR-0001", async () => {
    const avatarId = "test-avatar-sync";

    await client.call("avatar.recordProgressionEvent", {
      avatarId,
      amount: 40,
      statId: "focus",
    });

    await client.call("avatar.recordProgressionEvent", {
      avatarId,
      amount: 60,
      statId: "vitality",
    });

    const eventHistory = await client.call<AvatarGetEventsResult>("avatar.getEvents", {
      avatarId,
    });

    expect(eventHistory.events).toHaveLength(2);
    const firstEvent = eventHistory.events[0];
    const secondEvent = eventHistory.events[1];
    expect(firstEvent).toBeDefined();
    expect(secondEvent).toBeDefined();
    expect(firstEvent?.amount).toBe(40);
    expect(firstEvent?.statId).toBe("focus");
    expect(secondEvent?.amount).toBe(60);
    expect(secondEvent?.statId).toBe("vitality");
    // Events must be chronologically ordered and immutable
    expect(firstEvent!.timestamp).toBeLessThanOrEqual(secondEvent!.timestamp);
  });
});
