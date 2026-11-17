import type {
  AvatarProgression,
  ProgressionCalculation,
  ProgressionEvent,
  StatId,
  StatProgression,
} from "./types";

export const DEFAULT_BASE_LEVEL_XP = 100;

/**
 * Calculates level and progression deterministically from cumulative XP.
 * Progression is strictly additive; negative values are clamped non-punitively to 0.
 *
 * Formula: Cumulative XP for level L = baseLevelXp * (L - 1) * L / 2.
 * XP needed to reach L+1 from L is baseLevelXp * L.
 */
export function calculateProgression(
  totalXp: number,
  baseLevelXp = DEFAULT_BASE_LEVEL_XP
): ProgressionCalculation {
  const safeTotalXp = Math.max(0, Number.isFinite(totalXp) ? totalXp : 0);

  if (safeTotalXp === 0) {
    return {
      level: 1,
      currentXp: 0,
      nextLevelXp: baseLevelXp,
      totalXp: 0,
    };
  }

  const d = 1 + (8 * safeTotalXp) / baseLevelXp;
  const level = Math.floor((1 + Math.sqrt(d) + 1e-12) / 2);
  const xpForCurrentLevel = (baseLevelXp * (level - 1) * level) / 2;
  const currentXp = Math.round(safeTotalXp - xpForCurrentLevel);
  const nextLevelXp = baseLevelXp * level;

  return {
    level,
    currentXp,
    nextLevelXp,
    totalXp: safeTotalXp,
  };
}

/**
 * Aggregates an append-only sequence of progression events into full AvatarProgression.
 * Progression events (including point deductions from community plugins) are summed,
 * with total XP and individual stat XP clamped at a minimum of 0.
 */
export function calculateAvatarProgression(
  events: readonly ProgressionEvent[],
  baseLevelXp = DEFAULT_BASE_LEVEL_XP
): AvatarProgression {
  let totalAvatarXp = 0;
  const statXpMap: Record<StatId, number> = {};

  for (const event of events) {
    if (typeof event.amount !== "number" || !Number.isFinite(event.amount)) {
      continue;
    }

    totalAvatarXp += event.amount;

    if (event.statId) {
      statXpMap[event.statId] = (statXpMap[event.statId] ?? 0) + event.amount;
    }
  }

  const overallProgression = calculateProgression(Math.max(0, totalAvatarXp), baseLevelXp);
  const stats: Record<StatId, StatProgression> = {};

  for (const [statId, statTotalXp] of Object.entries(statXpMap)) {
    const calc = calculateProgression(Math.max(0, statTotalXp), baseLevelXp);
    stats[statId] = {
      statId,
      ...calc,
    };
  }

  return {
    ...overallProgression,
    stats,
  };
}
