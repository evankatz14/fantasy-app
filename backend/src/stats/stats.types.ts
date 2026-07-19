export interface RawWeekStats {
  pts_ppr?: number;
  pts_half_ppr?: number;
  pts_std?: number;
  gp?: number;
  // Passing
  pass_att?: number;
  pass_cmp?: number;
  pass_yd?: number;
  pass_td?: number;
  pass_int?: number;
  // Rushing
  rush_att?: number;
  rush_yd?: number;
  rush_td?: number;
  // Receiving
  rec_tgt?: number;
  rec?: number;
  rec_yd?: number;
  rec_td?: number;
  // Kicking
  fgm?: number;
  fga?: number;
  xpm?: number;
  // Misc
  fum_lost?: number;
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
