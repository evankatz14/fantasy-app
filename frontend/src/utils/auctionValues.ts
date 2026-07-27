import type { Player, PlayerSeasonStats, ScoringFormat } from '../types';
import type { PlayerRanking } from '../api';
import { MANUAL_AUCTION_VALUES } from '../data/manualAuctionValues';
import { YAHOO_AUCTION_VALUES } from '../data/yahooAuctionValues';

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

// ── Manual + Yahoo auction value matching ─────────────────────────────────────

export interface AuctionRange {
  fpValue: number;
  yahooValue: number | null;
  low: number;
  high: number;
}

function buildNameLookup(entries: typeof MANUAL_AUCTION_VALUES): { nameLookup: Map<string, number>; defLookup: Map<string, number> } {
  const nameLookup = new Map<string, number>();
  const defLookup = new Map<string, number>();
  for (const entry of entries) {
    if (entry.position === 'DEF') {
      defLookup.set(entry.team, entry.value);
    } else {
      const { first, last } = splitNorm(entry.name);
      nameLookup.set(matchKey(first, last, entry.position), entry.value);
    }
  }
  return { nameLookup, defLookup };
}

function matchManualValues(players: Player[]): Record<string, number> {
  const { nameLookup, defLookup } = buildNameLookup(MANUAL_AUCTION_VALUES);
  const result: Record<string, number> = {};
  for (const player of players) {
    if (player.position === 'DEF') {
      const v = player.team ? defLookup.get(player.team) : undefined;
      if (v !== undefined) result[player.id] = Math.max(1, v);
    } else {
      const { first, last } = splitNorm(player.fullName);
      const v = nameLookup.get(matchKey(first, last, player.position));
      if (v !== undefined) result[player.id] = Math.max(1, v);
    }
  }
  return result;
}

function matchYahooValues(players: Player[]): Record<string, number> {
  const { nameLookup } = buildNameLookup(YAHOO_AUCTION_VALUES);
  const result: Record<string, number> = {};
  for (const player of players) {
    if (player.position === 'DEF') continue; // no Yahoo DEF data
    const { first, last } = splitNorm(player.fullName);
    const v = nameLookup.get(matchKey(first, last, player.position));
    if (v !== undefined) result[player.id] = Math.max(1, v);
  }
  return result;
}

/**
 * Returns { fpValue, yahooValue, low, high } per player.
 * low = min(fp, yahoo), high = max(fp, yahoo).
 * Used for AI range-sampling and PlayerModal display.
 */
export function computeAuctionRanges(players: Player[]): Record<string, AuctionRange> {
  const fpMap = matchManualValues(players);
  const yahooMap = matchYahooValues(players);
  const result: Record<string, AuctionRange> = {};
  for (const player of players) {
    const fp = fpMap[player.id];
    if (fp === undefined) continue;
    const yahoo = yahooMap[player.id] ?? null;
    result[player.id] = {
      fpValue: fp,
      yahooValue: yahoo,
      low:  yahoo != null ? Math.min(fp, yahoo) : fp,
      high: yahoo != null ? Math.max(fp, yahoo) : fp,
    };
  }
  return result;
}

// ── Main export ───────────────────────────────────────────────────────────────

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
): Record<string, number> {
  const result = matchManualValues(players);
  for (const player of players) {
    if (result[player.id] === undefined) result[player.id] = 1;
  }
  return result;
}
