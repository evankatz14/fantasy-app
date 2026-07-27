export type FantasyPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';
export type ScoringFormat = 'standard' | 'half_ppr' | 'ppr';
export type DraftType = 'snake' | 'auction' | 'keeper';

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

export interface RosterSlots {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  K: number;
  DEF: number;
  FLEX: number;
  SFLEX: number;
  BN: number;
}

export interface ScoringSettings {
  passYdsPer: number;
  passTd: number;
  passInt: number;      // negative, e.g. -2
  rushYdsPer: number;
  rushTd: number;
  recYdsPer: number;
  recTd: number;
  rec: number;          // 0=std, 0.5=half, 1=ppr
  fgMade: number;
  xpMade: number;
  fumbleLost: number;   // negative, e.g. -2
}

export interface League {
  id: string;
  name: string;
  teamCount: number;
  scoringFormat: ScoringFormat;
  draftType: DraftType;
  rosterSlots: RosterSlots;
  auctionBudget?: number;
  superflex: boolean;
  scoringSettings: ScoringSettings;
}

export type ListItem =
  | { type: 'player'; id: string; playerId: string }
  | { type: 'tier'; id: string; name: string };

export interface PlayerSeasonStats {
  playerId: string;
  season: number;
  gamesPlayed: number;

  ptsPerGame: { ppr: number; half_ppr: number; standard: number };
  totalPts: { ppr: number; half_ppr: number; standard: number };

  passAtt: number | null;
  passCmp: number | null;
  passCmpPct: number | null;
  passYds: number | null;
  passYdsPg: number | null;
  passTds: number | null;
  passTdsPg: number | null;
  passInts: number | null;

  rushAtt: number | null;
  rushYds: number | null;
  rushYdsPg: number | null;
  rushYpc: number | null;
  rushTds: number | null;

  recTgts: number | null;
  rec: number | null;
  recYds: number | null;
  recYdsPg: number | null;
  recYpr: number | null;
  recTds: number | null;

  fgm: number | null;
  fga: number | null;
  fgPct: number | null;
  xpm: number | null;

  fumbleLost: number;
}

export interface PlayerWeekStats {
  week: number;
  passYds: number | null;
  passTds: number | null;
  passInts: number | null;
  passCmp: number | null;
  passAtt: number | null;
  rushYds: number | null;
  rushTds: number | null;
  rushAtt: number | null;
  rec: number | null;
  recYds: number | null;
  recTds: number | null;
  recTgts: number | null;
  fgm: number | null;
  fga: number | null;
  xpm: number | null;
  fumbleLost: number | null;
  ptsPpr: number | null;
  ptsHalfPpr: number | null;
  ptsStd: number | null;
}
