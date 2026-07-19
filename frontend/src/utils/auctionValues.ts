import type { Player, PlayerSeasonStats, ScoringFormat } from '../types';
import type { PlayerRanking, YahooPlayerValue } from '../api';

// ── Name normalization (must match backend logic) ─────────────────────────────

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\./g, '')
    .replace(/-/g, '')
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, '')
    .replace(/[^a-z\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function splitNorm(fullName: string): { first: string; last: string } {
  const norm = normalizeName(fullName);
  const idx = norm.indexOf(' ');
  if (idx === -1) return { first: norm, last: '' };
  return { first: norm.slice(0, idx), last: norm.slice(idx + 1) };
}

function matchKey(first: string, last: string, position: string): string {
  return `${first}|${last}|${position}`;
}

// ── PAR computation ───────────────────────────────────────────────────────────

const TEAMS = 12;
const BUDGET = 200;
const ROSTER_SIZE = 15;
const MAX_AUCTION_VALUE = 61; // anchors top player to FantasyPros consensus ceiling
const ECR_BLEND_ALPHA = 0.4;  // weight given to ECR rank vs PAR

// Starter-worthy player counts per position in a 12-team league
const STARTER_COUNTS: Partial<Record<string, number>> = {
  QB: 14,
  RB: 38,
  WR: 38,
  TE: 14,
  DEF: 12,
};

function computePAR(
  players: Player[],
  stats: Record<string, PlayerSeasonStats>,
  scoringFormat: ScoringFormat,
): Record<string, number> {
  const spendable = TEAMS * BUDGET - TEAMS * ROSTER_SIZE; // $2,220

  const byPosition: Record<string, { id: string; ppg: number }[]> = {};
  for (const player of players) {
    const pos = player.position;
    if (!STARTER_COUNTS[pos]) continue;
    const s = stats[player.id];
    if (!s) continue;
    const ppg = s.ptsPerGame[scoringFormat] ?? 0;
    if (ppg <= 0) continue;
    if (!byPosition[pos]) byPosition[pos] = [];
    byPosition[pos].push({ id: player.id, ppg });
  }
  for (const list of Object.values(byPosition)) {
    list.sort((a, b) => b.ppg - a.ppg);
  }

  const replacement: Record<string, number> = {};
  for (const [pos, list] of Object.entries(byPosition)) {
    const count = STARTER_COUNTS[pos] ?? 12;
    replacement[pos] = list[count]?.ppg ?? list.at(-1)?.ppg ?? 0;
  }

  const pars: { id: string; par: number }[] = [];
  for (const [pos, list] of Object.entries(byPosition)) {
    const rl = replacement[pos] ?? 0;
    for (const p of list) {
      pars.push({ id: p.id, par: Math.max(0, p.ppg - rl) });
    }
  }

  const totalPAR = pars.reduce((s, p) => s + p.par, 0);
  if (totalPAR === 0) return {};

  const values: Record<string, number> = {};
  for (const { id, par } of pars) {
    values[id] = (spendable * par) / totalPAR; // raw dollars, not yet floored
  }
  return values;
}

function normalizeToMax(values: Record<string, number>, maxVal: number): Record<string, number> {
  const currentMax = Math.max(1, ...Object.values(values));
  const scale = maxVal / currentMax;
  const result: Record<string, number> = {};
  for (const [id, v] of Object.entries(values)) {
    result[id] = Math.max(1, Math.round(v * scale));
  }
  return result;
}

// ── ECR rank → dollar value ───────────────────────────────────────────────────
// Uses power-law decay: value = C / rank^0.6
// Calibrated so rank 1 matches the top PAR value (before normalization).

function rankToDollar(rank: number, maxPAR: number): number {
  return maxPAR / Math.pow(rank, 0.6);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Matches Yahoo player values to Sleeper player IDs by name + position.
 * Returns Record<playerId, averageCost> for players with a non-null averageCost.
 */
export function matchYahooValues(
  yahooValues: YahooPlayerValue[],
  players: Player[],
): Record<string, number> {
  const lookup = new Map<string, number>();
  for (const y of yahooValues) {
    if (y.averageCost == null) continue;
    lookup.set(matchKey(y.firstName, y.lastName, y.position), y.averageCost);
  }

  const result: Record<string, number> = {};
  let matched = 0;
  for (const player of players) {
    const { first, last } = splitNorm(player.fullName);
    const cost = lookup.get(matchKey(first, last, player.position));
    if (cost != null) {
      result[player.id] = cost;
      matched++;
    }
  }
  console.log(`[auctionValues] Yahoo matched ${matched}/${players.length} players`);
  return result;
}

/**
 * Computes blended auction values:
 *   - For players with 2025 stats: 60% PAR + 40% ECR rank value
 *   - For rookies / no-stat players with ECR rank: 100% rank value
 *   - For players with stats but no ECR rank: 100% PAR
 * Normalizes so the top value = $61 (matching FantasyPros top player ceiling).
 */
export function computeAuctionValues(
  players: Player[],
  stats: Record<string, PlayerSeasonStats>,
  scoringFormat: ScoringFormat = 'half_ppr',
  rankings: PlayerRanking[] = [],
  yahooValues: Record<string, number> = {},
): Record<string, number> {
  // Step 1: PAR values (raw, un-floored dollars)
  const parRaw = computePAR(players, stats, scoringFormat);
  const maxPAR = Math.max(1, ...Object.values(parRaw));

  // Step 2: Match ECR rankings to player IDs
  const ecrById = new Map<string, { overallRank: number; positionRank: number }>();
  if (rankings.length > 0) {
    const lookup = new Map<string, { overallRank: number; positionRank: number }>();
    for (const r of rankings) {
      const { first, last } = splitNorm(r.playerName);
      lookup.set(matchKey(first, last, r.position), {
        overallRank: r.overallRank,
        positionRank: r.positionRank,
      });
    }
    for (const player of players) {
      const { first, last } = splitNorm(player.fullName);
      const entry = lookup.get(matchKey(first, last, player.position));
      if (entry) ecrById.set(player.id, entry);
    }
    console.log(`[auctionValues] ECR matched ${ecrById.size} / ${players.length} players`);
  }

  // Step 3: Blend PAR + rank value per player
  const blended: Record<string, number> = {};

  for (const player of players) {
    const par = parRaw[player.id];
    const ecr = ecrById.get(player.id);
    const rankVal = ecr ? rankToDollar(ecr.overallRank, maxPAR) : null;

    if (par != null && rankVal != null) {
      blended[player.id] = par * (1 - ECR_BLEND_ALPHA) + rankVal * ECR_BLEND_ALPHA;
    } else if (rankVal != null) {
      // Rookie or no historical stats — use rank value only
      blended[player.id] = rankVal;
    } else if (par != null) {
      blended[player.id] = par;
    }
    // Players with neither PAR nor ECR rank are excluded (get no value)
  }

  // Step 4: Override with Yahoo values where available (real auction market data)
  for (const [id, cost] of Object.entries(yahooValues)) {
    blended[id] = cost;
  }

  // Step 5: Normalize so max value = $61, floor at $1
  return normalizeToMax(blended, MAX_AUCTION_VALUE);
}
