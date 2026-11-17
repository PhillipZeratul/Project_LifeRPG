import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  RpcClient,
  RpcError,
  FeatureDisabledError,
  createMessageChannelTransportPair,
  BasePlugin,
  defineEvent,
  type IPluginManifest,
} from "@liferpg/sdk";
import {
  HostRpcBridge,
  CentralEventBus,
  CentralServiceRegistry,
} from "../index";

const TimerPingEvent = defineEvent<{ tick: number }>("timer:ping");

class MockTimerPlugin extends BasePlugin {
  public static tickReceivedCount = 0;
  public static isUnloaded = false;

  async onLoad() {
    MockTimerPlugin.tickReceivedCount = 0;
    MockTimerPlugin.isUnloaded = false;

    this.context.events.on(TimerPingEvent, () => {
      MockTimerPlugin.tickReceivedCount++;
    });

    // Register scoped RPC handlers via scoped plugin context
    (this.context as unknown as { registerRpcHandler: (method: string, handler: (p: { duration: number }) => unknown) => void })
      .registerRpcHandler?.("timer.start", (params) => {
        return {
          started: true,
          duration: params.duration,
          timestamp: Date.now(),
        };
      });
  }

  async onUnload() {
    MockTimerPlugin.isUnloaded = true;
  }
}

describe("Toggleable Core Plugin Lifecycle & Graceful Degradation Seam", () => {
  let bridge: HostRpcBridge;
  let eventBus: CentralEventBus;
  let serviceRegistry: CentralServiceRegistry;
  let client: RpcClient;
  let cleanup: () => void;

  const timerManifest: IPluginManifest = {
    name: "@liferpg/plugin-core-timer",
    version: "1.0.0",
    displayName: "Focus Timer Core Plugin",
    description: "Core timer capabilities",
    author: "LifeRPG Core Team",
    permissions: [],
  };

  beforeEach(() => {
    bridge = new HostRpcBridge();
    eventBus = new CentralEventBus();
    serviceRegistry = new CentralServiceRegistry(bridge, eventBus);

    // Baseline ping method on host to verify host stability
    bridge.registerHandler("system.ping", () => ({ pong: true }));

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

  it("dynamically registers a core plugin in disabled state and degrades gracefully", async () => {
    serviceRegistry.registerPlugin("@liferpg/plugin-core-timer", {
      manifest: timerManifest,
      loader: async () => ({ default: MockTimerPlugin }),
      service: {
        id: "timer",
        methods: ["timer.start"],
      },
    });

    // Availability checks via Client SDK
    expect(await client.isAvailable("timer")).toBe(false);
    expect(await client.isAvailable("timer.start")).toBe(false);
    expect(await client.isAvailable("@liferpg/plugin-core-timer")).toBe(false);

    // Invoking disabled service throws typed FeatureDisabledError
    await expect(
      client.call("timer.start", { duration: 1500 })
    ).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(FeatureDisabledError);
      expect(err).toBeInstanceOf(RpcError);
      const disabledErr = err as FeatureDisabledError;
      expect(disabledErr.code).toBe("FEATURE_DISABLED");
      expect(disabledErr.feature).toBe("timer");
      expect(disabledErr.method).toBe("timer.start");
      return true;
    });

    // Crucial: Host remains completely stable after disabled invocation
    const pingRes = await client.call<{ pong: boolean }>("system.ping");
    expect(pingRes.pong).toBe(true);
  });

  it("enables plugin dynamically, handles RPC requests, and reacts to events", async () => {
    serviceRegistry.registerPlugin("@liferpg/plugin-core-timer", {
      manifest: timerManifest,
      loader: async () => ({ default: MockTimerPlugin }),
      service: {
        id: "timer",
        methods: ["timer.start"],
      },
    });

    // Enable plugin
    await serviceRegistry.enablePlugin("@liferpg/plugin-core-timer");

    // Client SDK availability check reports true
    expect(await client.isAvailable("timer")).toBe(true);
    expect(await client.isAvailable("timer.start")).toBe(true);

    // Invoking enabled service succeeds
    const result = await client.call<{ started: boolean; duration: number }>(
      "timer.start",
      { duration: 1500 }
    );
    expect(result.started).toBe(true);
    expect(result.duration).toBe(1500);

    // Event listener attached in plugin is active
    expect(MockTimerPlugin.tickReceivedCount).toBe(0);
    eventBus.emit(TimerPingEvent, { tick: 1 });
    expect(MockTimerPlugin.tickReceivedCount).toBe(1);
  });

  it("disables plugin dynamically, disposes scoped listeners, and restores graceful degradation", async () => {
    serviceRegistry.registerPlugin("@liferpg/plugin-core-timer", {
      manifest: timerManifest,
      loader: async () => ({ default: MockTimerPlugin }),
      service: {
        id: "timer",
        methods: ["timer.start"],
      },
    });

    // 1. Enable
    await serviceRegistry.enablePlugin("@liferpg/plugin-core-timer");
    expect(await client.isAvailable("timer")).toBe(true);

    // 2. Disable
    await serviceRegistry.disablePlugin("@liferpg/plugin-core-timer");

    // Plugin lifecycle onUnload was invoked
    expect(MockTimerPlugin.isUnloaded).toBe(true);

    // Client SDK availability check reflects disabled status
    expect(await client.isAvailable("timer")).toBe(false);
    expect(await client.isAvailable("timer.start")).toBe(false);

    // Invoking disabled service throws FeatureDisabledError
    await expect(
      client.call("timer.start", { duration: 600 })
    ).rejects.toBeInstanceOf(FeatureDisabledError);

    // Scoped event listener was disposed; event emission no longer affects plugin
    const countBefore = MockTimerPlugin.tickReceivedCount;
    eventBus.emit(TimerPingEvent, { tick: 2 });
    expect(MockTimerPlugin.tickReceivedCount).toBe(countBefore);

    // Host remains stable
    const pingRes = await client.call<{ pong: boolean }>("system.ping");
    expect(pingRes.pong).toBe(true);
  });

  it("supports toggle lifecycle across multiple transitions cleanly without duplicate listeners", async () => {
    serviceRegistry.registerPlugin("@liferpg/plugin-core-timer", {
      manifest: timerManifest,
      loader: async () => ({ default: MockTimerPlugin }),
      service: {
        id: "timer",
        methods: ["timer.start"],
      },
    });

    // Transition 1: enable
    await serviceRegistry.enablePlugin("@liferpg/plugin-core-timer");
    expect(await client.isAvailable("timer")).toBe(true);
    eventBus.emit(TimerPingEvent, { tick: 1 });
    expect(MockTimerPlugin.tickReceivedCount).toBe(1);

    // Transition 2: disable
    await serviceRegistry.disablePlugin("@liferpg/plugin-core-timer");
    expect(await client.isAvailable("timer")).toBe(false);

    // Transition 3: re-enable
    await serviceRegistry.enablePlugin("@liferpg/plugin-core-timer");
    expect(await client.isAvailable("timer")).toBe(true);

    // Emitting 1 event should trigger exactly 1 listener execution (no duplicate listeners!)
    eventBus.emit(TimerPingEvent, { tick: 2 });
    expect(MockTimerPlugin.tickReceivedCount).toBe(1); // count was reset to 0 in onLoad

    const result = await client.call<{ started: boolean }>("timer.start", { duration: 300 });
    expect(result.started).toBe(true);
  });

  it("distinguishes between disabled feature error and unregistered method not found", async () => {
    serviceRegistry.registerPlugin("@liferpg/plugin-core-timer", {
      manifest: timerManifest,
      loader: async () => ({ default: MockTimerPlugin }),
      service: {
        id: "timer",
        methods: ["timer.start"],
      },
    });

    // timer.start is registered but disabled -> FEATURE_DISABLED
    await expect(client.call("timer.start")).rejects.toBeInstanceOf(FeatureDisabledError);

    // completely unknown method -> METHOD_NOT_FOUND (not FeatureDisabledError)
    await expect(client.call("completely.unknown.method")).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(RpcError);
      expect(err).not.toBeInstanceOf(FeatureDisabledError);
      expect((err as RpcError).code).toBe("METHOD_NOT_FOUND");
      return true;
    });
  });

  it("allows registering and toggling standalone non-plugin services via registry", async () => {
    serviceRegistry.registerService({
      id: "calendar-sync",
      name: "Calendar Sync Engine",
      methods: ["calendar.sync", "calendar.fetchChanges"],
      enabled: false,
    });

    bridge.registerHandler("calendar.sync", () => ({ synced: true }));

    // Initially disabled
    expect(await client.isAvailable("calendar-sync")).toBe(false);
    expect(await client.isAvailable("calendar.sync")).toBe(false);
    await expect(client.call("calendar.sync")).rejects.toBeInstanceOf(FeatureDisabledError);

    // Enable service
    await serviceRegistry.enableService("calendar-sync");
    expect(await client.isAvailable("calendar-sync")).toBe(true);
    expect(await client.isAvailable("calendar.sync")).toBe(true);
    const syncRes = await client.call<{ synced: boolean }>("calendar.sync");
    expect(syncRes.synced).toBe(true);

    // Disable service
    await serviceRegistry.disableService("calendar-sync");
    expect(await client.isAvailable("calendar-sync")).toBe(false);
    await expect(client.call("calendar.sync")).rejects.toBeInstanceOf(FeatureDisabledError);
  });

  it("handles the actual builtin @liferpg/plugin-core-timer lifecycle out of the box", async () => {
    // Builtin timer plugin is registered on startup in disabled state
    expect(await client.isAvailable("timer")).toBe(false);
    expect(await client.isAvailable("timer.start")).toBe(false);
    await expect(client.call("timer.start", { durationSeconds: 60 })).rejects.toBeInstanceOf(
      FeatureDisabledError
    );

    // Enable builtin plugin
    await serviceRegistry.enablePlugin("@liferpg/plugin-core-timer");
    expect(await client.isAvailable("timer")).toBe(true);

    const startRes = await client.call<{ started: boolean; durationSeconds: number }>(
      "timer.start",
      { durationSeconds: 120 }
    );
    expect(startRes.started).toBe(true);
    expect(startRes.durationSeconds).toBe(120);

    const statusRes = await client.call<{ active: boolean; currentDuration: number }>(
      "timer.status"
    );
    expect(statusRes.active).toBe(true);
    expect(statusRes.currentDuration).toBe(120);

    const stopRes = await client.call<{ stopped: boolean }>("timer.stop");
    expect(stopRes.stopped).toBe(true);

    // Disable builtin plugin
    await serviceRegistry.disablePlugin("@liferpg/plugin-core-timer");
    expect(await client.isAvailable("timer")).toBe(false);
    await expect(client.call("timer.start")).rejects.toBeInstanceOf(FeatureDisabledError);
  });
});
