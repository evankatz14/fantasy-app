export type FantasyPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';

export interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  position: string;
  team?: string;
  age?: number;
  years_exp?: number;
  injury_status?: string | null;
  status?: string;
  number?: number;
  depth_chart_position?: number;
  search_rank?: number;
  fantasy_positions?: string[];
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  position: FantasyPosition;
  team: string | null;
  age: number | null;
  yearsExp: number | null;
  injuryStatus: string | null;
  status: string | null;
  number: number | null;
  depthChartPosition: number | null;
}
