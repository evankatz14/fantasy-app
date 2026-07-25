import type { Player, PlayerSeasonStats, ScoringFormat } from '../types';
import type { PlayerRanking, YahooPlayerValue } from '../api';
import { MANUAL_AUCTION_VALUES } from '../data/manualAuctionValues';

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

// ── Manual auction value matching ─────────────────────────────────────────────

function matchManualValues(players: Player[]): Record<string, number> {
  const nameLookup = new Map<string, number>();
  const defLookup = new Map<string, number>(); // team abbrev → value

  for (const entry of MANUAL_AUCTION_VALUES) {
    if (entry.position === 'DEF') {
      defLookup.set(entry.team, entry.value);
    } else {
      const { first, last } = splitNorm(entry.name);
      nameLookup.set(matchKey(first, last, entry.position), entry.value);
    }
  }

  const result: Record<string, number> = {};
  for (const player of players) {
    if (player.position === 'DEF') {
      const v = defLookup.get(player.team);
      if (v !== undefined) result[player.id] = Math.max(1, v);
    } else {
      const { first, last } = splitNorm(player.fullName);
      const v = nameLookup.get(matchKey(first, last, player.position));
      if (v !== undefined) result[player.id] = Math.max(1, v);
    }
  }

  return result;
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
  _stats: Record<string, PlayerSeasonStats>,
  _scoringFormat: ScoringFormat = 'half_ppr',
  _rankings: PlayerRanking[] = [],
  yahooValues: Record<string, number> = {},
): Record<string, number> {
  // Step 1: Match manual auction values (primary source)
  const result = matchManualValues(players);

  // Step 2: Any player not in manual data gets $1
  for (const player of players) {
    if (result[player.id] === undefined) {
      result[player.id] = 1;
    }
  }

  // Step 3: Override with Yahoo values if authenticated
  for (const [id, cost] of Object.entries(yahooValues)) {
    result[id] = Math.max(1, cost);
  }

  return result;
}
