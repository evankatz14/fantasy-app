import type { Player } from '../types';
import type { AuctionTeam } from '../store/useAuctionStore';

export type AIPersonality = 'aggressive' | 'balanced' | 'conservative';

export const PERSONALITY_FACTOR: Record<AIPersonality, number> = {
  aggressive: 1.15,
  balanced: 1.0,
  conservative: 0.82,
};

// How quickly each personality reacts to bids (ms range)
export const PERSONALITY_DELAY: Record<AIPersonality, [number, number]> = {
  aggressive: [800, 3500],
  balanced: [2000, 6000],
  conservative: [3500, 8000],
};

// 11 AI teams: 3 aggressive, 5 balanced, 3 conservative
export const AI_PERSONALITIES: AIPersonality[] = [
  'aggressive', 'aggressive', 'aggressive',
  'balanced', 'balanced', 'balanced', 'balanced', 'balanced',
  'conservative', 'conservative', 'conservative',
];

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

// Chance to drop out early even under target value (simulates saving budget)
const DROPOUT_CHANCE: Record<AIPersonality, number> = {
  aggressive: 0.04,
  balanced: 0.10,
  conservative: 0.18,
};

/**
 * Returns the bid amount this AI team wants to place, or null if they pass.
 *
 * Bid sizing: large jumps when the current price is far below the AI's target
 * (to avoid slow $1 crawls on underpriced players), grinding $1-2 increments
 * only when close to the ceiling.
 *
 * Randomness comes from two sources:
 *  1. Per-call value variance (±20%) so the same AI evaluates the same player
 *     slightly differently each time — creating natural dropout and occasional
 *     overpay without being deterministic.
 *  2. A personality-weighted dropout chance so even aggressive teams sometimes
 *     fold early to conserve budget for later picks.
 */
export function getAIBid(
  team: AuctionTeam,
  player: Player,
  currentBid: number,
  playerValues: Record<string, number>,
): number | null {
  const personality = team.personality as AIPersonality;
  const baseValue = playerValues[player.id] ?? 1;

  // ±20% variance on this evaluation — AI opinion of the player fluctuates
  const variance = 0.80 + Math.random() * 0.40;
  const targetValue = Math.round(
    baseValue * PERSONALITY_FACTOR[personality] * positionNeedFactor(team, player) * variance,
  );

  if (currentBid >= targetValue) return null;

  const affordable = maxBid(team);
  if (currentBid + 1 > affordable) return null;

  // Budget-conservation dropout — even when they could bid, they sometimes pass
  if (Math.random() < DROPOUT_CHANCE[personality]) return null;

  // ── Bid sizing based on where the current price sits relative to target ──
  const ratio = currentBid / targetValue;
  let bidTo: number;

  if (ratio < 0.30) {
    // Very underpriced: jump to 25–50% of target in one move
    bidTo = Math.round(targetValue * (0.25 + Math.random() * 0.25));
  } else if (ratio < 0.65) {
    // Still underpriced: close 25–45% of the remaining gap
    const gap = targetValue - currentBid;
    bidTo = currentBid + Math.round(gap * (0.25 + Math.random() * 0.20));
  } else {
    // Near ceiling: $1–3 increments
    bidTo = currentBid + 1 + Math.floor(Math.random() * 2);
  }

  // Clamp: must exceed current bid; can't exceed target or budget floor
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
