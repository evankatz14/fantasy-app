import type { ScoringSettings, PlayerSeasonStats, PlayerWeekStats } from '../types';

export const DEFAULT_SCORING: ScoringSettings = {
  passYdsPer: 25, passTd: 4, passInt: -2,
  rushYdsPer: 10, rushTd: 6,
  recYdsPer: 10, recTd: 6, rec: 0.5,
  fgMade: 3, xpMade: 1,
  fumbleLost: -2,
};

export function calcCustomWeekPts(week: PlayerWeekStats, s: ScoringSettings): number {
  let pts = 0;
  pts += (week.passYds ?? 0) / s.passYdsPer;
  pts += (week.passTds ?? 0) * s.passTd;
  pts += (week.passInts ?? 0) * s.passInt;
  pts += (week.rushYds ?? 0) / s.rushYdsPer;
  pts += (week.rushTds ?? 0) * s.rushTd;
  pts += (week.recYds ?? 0) / s.recYdsPer;
  pts += (week.recTds ?? 0) * s.recTd;
  pts += (week.rec ?? 0) * s.rec;
  pts += (week.fgm ?? 0) * s.fgMade;
  pts += (week.xpm ?? 0) * s.xpMade;
  pts += (week.fumbleLost ?? 0) * s.fumbleLost;
  return Math.round(pts * 100) / 100;
}

export function calcCustomPpg(stats: PlayerSeasonStats, s: ScoringSettings): number {
  if (!stats.gamesPlayed) return 0;
  let total = 0;
  total += (stats.passYds ?? 0) / s.passYdsPer;
  total += (stats.passTds ?? 0) * s.passTd;
  total += (stats.passInts ?? 0) * s.passInt;
  total += (stats.rushYds ?? 0) / s.rushYdsPer;
  total += (stats.rushTds ?? 0) * s.rushTd;
  total += (stats.recYds ?? 0) / s.recYdsPer;
  total += (stats.recTds ?? 0) * s.recTd;
  total += (stats.rec ?? 0) * s.rec;
  total += (stats.fgm ?? 0) * s.fgMade;
  total += (stats.xpm ?? 0) * s.xpMade;
  total += (stats.fumbleLost ?? 0) * s.fumbleLost;
  return Math.round((total / stats.gamesPlayed) * 10) / 10;
}
