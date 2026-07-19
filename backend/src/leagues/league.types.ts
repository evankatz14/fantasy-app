export type ScoringFormat = 'standard' | 'half_ppr' | 'ppr';
export type DraftType = 'snake' | 'auction';

export interface RosterSlots {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  K: number;
  DEF: number;
  FLEX: number;
  SFLEX: number;
}

export interface ScoringSettings {
  passYdsPer: number;   // yards per point (e.g. 25 → 1 pt per 25 yds)
  passTd: number;       // pts per passing TD
  passInt: number;      // pts per INT (negative, e.g. -2)
  rushYdsPer: number;   // yards per point
  rushTd: number;       // pts per rushing TD
  recYdsPer: number;    // yards per point
  recTd: number;        // pts per receiving TD
  rec: number;          // pts per reception (0=std, 0.5=half, 1=ppr)
  fgMade: number;       // pts per FG made
  xpMade: number;       // pts per XP made
  fumbleLost: number;   // pts per fumble lost (negative, e.g. -2)
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

export class CreateLeagueDto {
  name: string;
  teamCount: number;
  scoringFormat: ScoringFormat;
  draftType: DraftType;
  rosterSlots: RosterSlots;
  auctionBudget?: number;
  superflex: boolean;
  scoringSettings?: ScoringSettings;
}

export class UpdateLeagueDto {
  name?: string;
  teamCount?: number;
  scoringFormat?: ScoringFormat;
  draftType?: DraftType;
  rosterSlots?: RosterSlots;
  auctionBudget?: number;
  superflex?: boolean;
  scoringSettings?: ScoringSettings;
}
