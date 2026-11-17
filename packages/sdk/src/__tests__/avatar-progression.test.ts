import { describe, it, expect } from "vitest";
import {
  calculateProgression,
  calculateAvatarProgression,
  type ProgressionEvent,
} from "../foundation/avatar";

describe("Avatar Progression Calculation (Pure Deterministic Engine)", () => {
  it("calculates level 1 progression with zero total XP", () => {
    const result = calculateProgression(0);
    expect(result).toEqual({
      level: 1,
      currentXp: 0,
      nextLevelXp: 100,
      totalXp: 0,
    });
  });

  it("calculates progression within level 1", () => {
    const result = calculateProgression(75);
    expect(result).toEqual({
      level: 1,
      currentXp: 75,
      nextLevelXp: 100,
      totalXp: 75,
    });
  });

  it("advances to level 2 at exactly 100 XP threshold", () => {
    const result = calculateProgression(100);
    expect(result).toEqual({
      level: 2,
      currentXp: 0,
      nextLevelXp: 200,
      totalXp: 100,
    });
  });

  it("calculates progression across higher levels deterministically", () => {
    // Level 1: 0..99 (needs 100)
    // Level 2: 100..299 (needs 200)
    // Level 3: 300..599 (needs 300)
    // Level 4: 600..999 (needs 400)
    const resultLvl3 = calculateProgression(450);
    expect(resultLvl3).toEqual({
      level: 3,
      currentXp: 150,
      nextLevelXp: 300,
      totalXp: 450,
    });

    const resultLvl4 = calculateProgression(600);
    expect(resultLvl4).toEqual({
      level: 4,
      currentXp: 0,
      nextLevelXp: 400,
      totalXp: 600,
    });
  });

  it("handles negative input by clamping to 0 (non-punitive fallback)", () => {
    const result = calculateProgression(-50);
    expect(result).toEqual({
      level: 1,
      currentXp: 0,
      nextLevelXp: 100,
      totalXp: 0,
    });
  });

  it("calculates progression with point deductions from community plugins clamped at 0", () => {
    const events: ProgressionEvent[] = [
      {
        id: "evt-gain-1",
        avatarId: "avatar-default",
        type: "xp_gained",
        amount: 150,
        timestamp: 1000,
      },
      {
        id: "evt-deduct-1",
        avatarId: "avatar-default",
        type: "xp_deducted",
        amount: -50,
        timestamp: 2000,
      },
      {
        id: "evt-stat-gain",
        avatarId: "avatar-default",
        type: "stat_xp_gained",
        statId: "focus",
        amount: 80,
        timestamp: 3000,
      },
      {
        id: "evt-stat-deduct",
        avatarId: "avatar-default",
        type: "stat_xp_deducted",
        statId: "focus",
        amount: -30,
        timestamp: 4000,
      },
    ];

    const progression = calculateAvatarProgression(events);
    // Total XP = 150 - 50 + 80 - 30 = 150
    // Level 2 (100 threshold), currentXp: 50, nextLevelXp: 200
    expect(progression.totalXp).toBe(150);
    expect(progression.level).toBe(2);
    expect(progression.currentXp).toBe(50);

    // Focus Stat: 80 - 30 = 50 XP -> Level 1, currentXp: 50, nextLevelXp: 100
    expect(progression.stats["focus"]).toEqual({
      statId: "focus",
      level: 1,
      currentXp: 50,
      nextLevelXp: 100,
      totalXp: 50,
    });
  });

  it("aggregates an append-only event stream into full AvatarProgression", () => {
    const events: ProgressionEvent[] = [
      {
        id: "evt-1",
        avatarId: "avatar-default",
        type: "xp_gained",
        amount: 80,
        timestamp: 1000,
      },
      {
        id: "evt-2",
        avatarId: "avatar-default",
        type: "stat_xp_gained",
        statId: "focus",
        amount: 50,
        timestamp: 2000,
      },
      {
        id: "evt-3",
        avatarId: "avatar-default",
        type: "stat_xp_gained",
        statId: "vitality",
        amount: 120,
        timestamp: 3000,
      },
      {
        id: "evt-4",
        avatarId: "avatar-default",
        type: "stat_xp_gained",
        statId: "focus",
        amount: 70,
        timestamp: 4000,
      },
    ];

    const progression = calculateAvatarProgression(events);

    // Total XP = 80 + 50 + 120 + 70 = 320
    // Level 3 requires 300, so level 3 with 20 current XP (next level needs 300)
    expect(progression.totalXp).toBe(320);
    expect(progression.level).toBe(3);
    expect(progression.currentXp).toBe(20);
    expect(progression.nextLevelXp).toBe(300);

    // Focus Stat: 50 + 70 = 120 XP -> Level 2 (100 required for lvl 2), currentXp: 20, nextLevelXp: 200
    expect(progression.stats["focus"]).toEqual({
      statId: "focus",
      level: 2,
      currentXp: 20,
      nextLevelXp: 200,
      totalXp: 120,
    });

    // Vitality Stat: 120 XP -> Level 2, currentXp: 20, nextLevelXp: 200
    expect(progression.stats["vitality"]).toEqual({
      statId: "vitality",
      level: 2,
      currentXp: 20,
      nextLevelXp: 200,
      totalXp: 120,
    });
  });
});
