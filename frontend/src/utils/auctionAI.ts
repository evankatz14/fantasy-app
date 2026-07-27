import type { Player } from '../types';
import type { AuctionTeam } from '../store/useAuctionStore';

export type AIPersonality = 'aggressive' | 'balanced' | 'conservative' | 'boom_bust';

export const PERSONALITY_FACTOR: Record<AIPersonality, number> = {
  aggressive: 1.08,
  balanced: 0.97,
  conservative: 0.78,
  boom_bust: 1.40, // will pay way over value for elite players
};

// How quickly each personality reacts to bids (ms range)
export const PERSONALITY_DELAY: Record<AIPersonality, [number, number]> = {
  aggressive:   [800,  3500],
  balanced:     [2000, 6000],
  conservative: [3500, 8000],
  boom_bust:    [600,  2500], // decisive — knows what they want
};

const DROPOUT_CHANCE: Record<AIPersonality, number> = {
  aggressive:   0.06,
  balanced:     0.12,
  conservative: 0.22,
  boom_bust:    0.02, // rarely drops out on elite players; handled separately below
};

// Boom/bust value threshold — only goes all-in on players above this
const BOOM_BUST_ELITE_THRESHOLD = 28;

/** Randomize AI personalities for `count` teams. Proportions scale with count. */
export function randomizePersonalities(count: number = 11): AIPersonality[] {
  const pool: AIPersonality[] = [];
  const aggressive = Math.max(1, 1 + Math.floor(Math.random() * 4));
  const conservative = Math.max(1, 1 + Math.floor(Math.random() * 3));
  const boom_bust = Math.floor(Math.random() * 3);
  const balanced = Math.max(0, count - aggressive - conservative - boom_bust);

  for (let i = 0; i < aggressive; i++) pool.push('aggressive');
  for (let i = 0; i < balanced; i++) pool.push('balanced');
  for (let i = 0; i < conservative; i++) pool.push('conservative');
  for (let i = 0; i < boom_bust; i++) pool.push('boom_bust');

  // Fill any remaining slots (small leagues) with 'balanced'
  while (pool.length < count) pool.push('balanced');

  // Shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

/** Maximum bid this team can place while keeping $1 reserved per remaining empty slot */
export function maxBid(team: AuctionTeam): number {
  const emptySlots = team.roster.filter(s => s.playerId === null).length;
  if (emptySlots === 0) return 0;
  return team.budget - (emptySlots - 1);
}

function positionNeedFactor(team: AuctionTeam, player: Player): number {
  const eligible = team.roster.filter(
    s => s.playerId === null && s.eligiblePositions.includes(player.position),
  );
  if (eligible.length === 0) return 0.4; // position already covered

  const hasStarter = team.roster.some(
    s => s.playerId !== null && !s.isBench && s.eligiblePositions.includes(player.position),
  );
  // Desperate for first starter at this position
  return hasStarter ? 1.0 : 1.15;
}


/**
 * Returns the bid amount this AI team wants to place, or null if they pass.
 *
 * When playerValueRanges is provided, the AI samples a market price from the
 * FP/Yahoo range [low, high] instead of applying arbitrary variance. This creates
 * data-driven price uncertainty — teams that sample near Yahoo value may bid high;
 * teams that sample near FP value bid conservatively.
 */
export function getAIBid(
  team: AuctionTeam,
  player: Player,
  currentBid: number,
  playerValues: Record<string, number>,
  playerValueRanges?: Record<string, { low: number; high: number }>,
): number | null {
  const personality = team.personality as AIPersonality;
  const baseValue = playerValues[player.id] ?? 1;
  const affordable = maxBid(team);
  if (currentBid + 1 > affordable) return null;

  const range = playerValueRanges?.[player.id];

  // Sample a market value: range-based if available, variance-based otherwise
  function sampleMarket(): number {
    if (range && range.high > range.low) {
      return range.low + Math.random() * (range.high - range.low);
    }
    return baseValue * (0.72 + Math.random() * 0.48); // [0.72, 1.20] fallback
  }

  // ── Boom/bust: go all-in on elite players, skip everyone else ────────────
  if (personality === 'boom_bust') {
    const eliteSlotsFilled = team.roster.filter(s => s.playerId !== null && !s.isBench).length;
    if (baseValue < BOOM_BUST_ELITE_THRESHOLD || eliteSlotsFilled >= 3) {
      if (Math.random() < 0.82) return null;
    }
    const marketValue = sampleMarket();
    const rawTarget = marketValue * PERSONALITY_FACTOR['boom_bust'];
    const cap = range ? range.high * 1.20 : baseValue * 1.50;
    const targetValue = Math.round(Math.min(rawTarget, cap));
    if (currentBid >= targetValue) return null;
    if (Math.random() < DROPOUT_CHANCE['boom_bust']) return null;
    const ratio = currentBid / targetValue;
    let bidTo: number;
    if (ratio < 0.50) {
      bidTo = Math.round(targetValue * (0.50 + Math.random() * 0.20));
    } else {
      bidTo = currentBid + 1 + Math.floor(Math.random() * 2);
    }
    return Math.max(currentBid + 1, Math.min(bidTo, targetValue, affordable));
  }

  // ── Standard personalities ────────────────────────────────────────────────
  const marketValue = sampleMarket();
  const rawTarget = marketValue * PERSONALITY_FACTOR[personality] * positionNeedFactor(team, player);
  // Cap: slight overpay allowed above the range high (or FP value when no range)
  const cap = range ? range.high * 1.12 : baseValue * 1.20;
  const targetValue = Math.round(Math.min(rawTarget, cap));

  if (currentBid >= targetValue) return null;

  // Budget pressure: teams running low drop out more aggressively
  const budgetRatio = team.budget / (team.initialBudget || 200);
  const budgetMultiplier = budgetRatio < 0.4 ? 2.0 : budgetRatio < 0.6 ? 1.4 : 1.0;

  if (Math.random() < DROPOUT_CHANCE[personality] * budgetMultiplier) return null;

  // ── Bid sizing based on where the current price sits relative to target ──
  const ratio = currentBid / targetValue;
  let bidTo: number;

  if (ratio < 0.30) {
    bidTo = Math.round(targetValue * (0.25 + Math.random() * 0.25));
  } else if (ratio < 0.65) {
    const gap = targetValue - currentBid;
    bidTo = currentBid + Math.round(gap * (0.25 + Math.random() * 0.20));
  } else {
    bidTo = currentBid + 1 + Math.floor(Math.random() * 2);
  }

  return Math.max(currentBid + 1, Math.min(bidTo, targetValue, affordable));
}

/** Returns the player ID this team should nominate */
export function nominationChoice(
  team: AuctionTeam,
  availableIds: string[],
  players: Player[],
  playerValues: Record<string, number>,
): string | null {
  if (!availableIds.length) return null;
  const playerMap = new Map(players.map(p => [p.id, p]));

  const scored = availableIds
    .map(id => {
      const p = playerMap.get(id);
      if (!p) return null;
      return { id, score: (playerValues[id] ?? 1) * positionNeedFactor(team, p) };
    })
    .filter(Boolean)
    .sort((a, b) => b!.score - a!.score);

  return scored[0]?.id ?? availableIds[0];
}
