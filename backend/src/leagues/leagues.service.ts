import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { League, CreateLeagueDto, UpdateLeagueDto, ScoringSettings } from './league.types';

const HALF_PPR_4PT: ScoringSettings = {
  passYdsPer: 25, passTd: 4, passInt: -2,
  rushYdsPer: 10, rushTd: 6,
  recYdsPer: 10, recTd: 6, rec: 0.5,
  fgMade: 3, xpMade: 1,
  fumbleLost: -2,
};

const HALF_PPR_6PT: ScoringSettings = {
  passYdsPer: 25, passTd: 6, passInt: -2,
  rushYdsPer: 10, rushTd: 6,
  recYdsPer: 10, recTd: 6, rec: 0.5,
  fgMade: 3, xpMade: 1,
  fumbleLost: -2,
};

const DEFAULT_LEAGUES: League[] = [
  {
    id: 'league-superflex',
    name: '10-Team Superflex',
    teamCount: 10,
    scoringFormat: 'half_ppr',
    draftType: 'snake',
    superflex: true,
    rosterSlots: { QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DEF: 1, FLEX: 2, SFLEX: 1 },
    scoringSettings: HALF_PPR_6PT,
  },
  {
    id: 'league-auction',
    name: '12-Team Auction',
    teamCount: 12,
    scoringFormat: 'half_ppr',
    draftType: 'auction',
    superflex: false,
    auctionBudget: 200,
    rosterSlots: { QB: 1, RB: 2, WR: 2, TE: 1, K: 0, DEF: 0, FLEX: 1, SFLEX: 0 },
    scoringSettings: HALF_PPR_4PT,
  },
];

@Injectable()
export class LeaguesService {
  private leagues: Map<string, League> = new Map(
    DEFAULT_LEAGUES.map((l) => [l.id, l]),
  );

  findAll(): League[] {
    return Array.from(this.leagues.values());
  }

  findOne(id: string): League {
    const league = this.leagues.get(id);
    if (!league) throw new NotFoundException(`League ${id} not found`);
    return league;
  }

  create(dto: CreateLeagueDto): League {
    const scoringSettings: ScoringSettings = dto.scoringSettings ?? HALF_PPR_4PT;
    const league: League = { id: randomUUID(), ...dto, scoringSettings };
    this.leagues.set(league.id, league);
    return league;
  }

  update(id: string, dto: UpdateLeagueDto): League {
    const existing = this.findOne(id);
    const updated: League = { ...existing, ...dto, id };
    this.leagues.set(id, updated);
    return updated;
  }

  remove(id: string): void {
    if (!this.leagues.has(id)) throw new NotFoundException(`League ${id} not found`);
    this.leagues.delete(id);
  }
}
