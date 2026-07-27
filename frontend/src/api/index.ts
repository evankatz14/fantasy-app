import type { Player, League, PlayerSeasonStats, PlayerWeekStats, ScoringSettings } from '../types';

// In dev, VITE_API_URL is unset and Vite's proxy handles /api → localhost:3001.
// In production, VITE_API_URL is the Render backend URL (no trailing slash).
const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api`;

export async function fetchPlayers(position?: string): Promise<Player[]> {
  const url = position ? `${BASE}/players?position=${position}` : `${BASE}/players`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch players');
  return res.json();
}

export async function fetchLeagues(): Promise<League[]> {
  const res = await fetch(`${BASE}/leagues`);
  if (!res.ok) throw new Error('Failed to fetch leagues');
  return res.json();
}

export async function fetchStats(season = 2025): Promise<Record<string, PlayerSeasonStats>> {
  const res = await fetch(`${BASE}/stats/${season}`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function fetchPlayerStats(playerId: string): Promise<PlayerSeasonStats[]> {
  const res = await fetch(`${BASE}/stats/player/${playerId}`);
  if (!res.ok) throw new Error('Failed to fetch player stats');
  return res.json();
}

export async function fetchPlayerWeeklyStats(playerId: string, season: number): Promise<PlayerWeekStats[]> {
  const res = await fetch(`${BASE}/stats/player/${playerId}/weekly/${season}`);
  if (!res.ok) throw new Error('Failed to fetch weekly stats');
  return res.json();
}

export interface PlayerRanking {
  playerName: string;
  firstName: string;
  lastName: string;
  position: string;  // QB RB WR TE DEF
  team: string;
  overallRank: number;
  positionRank: number;
  tier: number;
}

export async function fetchPlayerRankings(format: 'half_ppr' | 'ppr' | 'standard' = 'half_ppr'): Promise<PlayerRanking[]> {
  const res = await fetch(`${BASE}/auction-values?format=${format}`);
  if (!res.ok) return [];
  return res.json();
}


export async function updateLeagueScoringSettings(leagueId: string, scoringSettings: ScoringSettings): Promise<League> {
  const res = await fetch(`${BASE}/leagues/${leagueId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scoringSettings }),
  });
  if (!res.ok) throw new Error('Failed to update league');
  return res.json();
}
