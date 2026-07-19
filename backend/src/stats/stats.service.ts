import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { RawWeekStats, PlayerSeasonStats, PlayerWeekStats } from './stats.types';

const SLEEPER_STATS_BASE = 'https://api.sleeper.app/v1/stats/nfl/regular';
const NFL_WEEKS = 18;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SEASONS = [2025, 2024, 2023, 2022];

type Totals = RawWeekStats & { totalGames: number };

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function pct(num: number, den: number): number | null {
  if (!den) return null;
  return Math.round((num / den) * 1000) / 10;
}

function pg(total: number, games: number): number | null {
  if (!games) return null;
  return round1(total / games);
}

function ypu(yds: number, att: number): number | null {
  if (!att) return null;
  return round1(yds / att);
}

function orNull(val: number | undefined): number | null {
  return val != null && val !== 0 ? val : null;
}

@Injectable()
export class StatsService implements OnModuleInit {
  private readonly logger = new Logger(StatsService.name);
  private cache = new Map<number, Map<string, PlayerSeasonStats>>();
  private weeklyCache = new Map<number, Map<string, PlayerWeekStats[]>>();
  private cacheLoadedAt = new Map<number, number>();

  constructor(private readonly http: HttpService) {}

  async onModuleInit() {
    this.preloadAllSeasons();
  }

  async getStats(season: number): Promise<Record<string, PlayerSeasonStats>> {
    if (!this.isCacheValid(season)) await this.loadSeason(season);
    const map = this.cache.get(season);
    return map ? Object.fromEntries(map.entries()) : {};
  }

  async getPlayerStats(playerId: string): Promise<PlayerSeasonStats[]> {
    const results: PlayerSeasonStats[] = [];
    for (const season of SEASONS) {
      const all = await this.getStats(season);
      if (all[playerId]) results.push(all[playerId]);
    }
    return results;
  }

  async getPlayerWeeklyStats(playerId: string, season: number): Promise<PlayerWeekStats[]> {
    if (!this.isCacheValid(season)) await this.loadSeason(season);
    return this.weeklyCache.get(season)?.get(playerId) ?? [];
  }

  private isCacheValid(season: number): boolean {
    const t = this.cacheLoadedAt.get(season);
    return t !== undefined && Date.now() - t < CACHE_TTL_MS;
  }

  private async preloadAllSeasons(): Promise<void> {
    for (const season of SEASONS) {
      await this.loadSeason(season).catch((e) =>
        this.logger.warn(`Stats preload ${season} failed: ${e.message}`),
      );
    }
  }

  private async loadSeason(season: number): Promise<void> {
    if (this.isCacheValid(season)) return;
    this.logger.log(`Fetching ${season} stats (${NFL_WEEKS} weeks)...`);

    const weekResults = await Promise.all(
      Array.from({ length: NFL_WEEKS }, (_, i) =>
        firstValueFrom(
          this.http.get<Record<string, RawWeekStats>>(`${SLEEPER_STATS_BASE}/${season}/${i + 1}`),
        )
          .then((r) => ({ week: i + 1, data: r.data }))
          .catch(() => ({ week: i + 1, data: {} as Record<string, RawWeekStats> })),
      ),
    );

    const totalsMap = new Map<string, Totals>();
    const weeklyMap = new Map<string, PlayerWeekStats[]>();

    for (const { week, data } of weekResults) {
      for (const [id, s] of Object.entries(data)) {
        if (!s || (s.gp ?? 0) === 0) continue;

        // Weekly game log
        const playerWeeks = weeklyMap.get(id) ?? [];
        playerWeeks.push({
          week,
          passYds: orNull(s.pass_yd),
          passTds: orNull(s.pass_td),
          passInts: orNull(s.pass_int),
          passCmp: orNull(s.pass_cmp),
          passAtt: orNull(s.pass_att),
          rushYds: orNull(s.rush_yd),
          rushTds: orNull(s.rush_td),
          rushAtt: orNull(s.rush_att),
          rec: orNull(s.rec),
          recYds: orNull(s.rec_yd),
          recTds: orNull(s.rec_td),
          recTgts: orNull(s.rec_tgt),
          fgm: orNull(s.fgm),
          fga: orNull(s.fga),
          xpm: orNull(s.xpm),
          fumbleLost: orNull(s.fum_lost),
          ptsPpr: s.pts_ppr ?? null,
          ptsHalfPpr: s.pts_half_ppr ?? null,
          ptsStd: s.pts_std ?? null,
        });
        weeklyMap.set(id, playerWeeks);

        // Season aggregation
        const ex = totalsMap.get(id) ?? ({ totalGames: 0 } as Totals);
        totalsMap.set(id, {
          totalGames: ex.totalGames + (s.gp ?? 0),
          pts_ppr: (ex.pts_ppr ?? 0) + (s.pts_ppr ?? 0),
          pts_half_ppr: (ex.pts_half_ppr ?? 0) + (s.pts_half_ppr ?? 0),
          pts_std: (ex.pts_std ?? 0) + (s.pts_std ?? 0),
          pass_att: (ex.pass_att ?? 0) + (s.pass_att ?? 0),
          pass_cmp: (ex.pass_cmp ?? 0) + (s.pass_cmp ?? 0),
          pass_yd: (ex.pass_yd ?? 0) + (s.pass_yd ?? 0),
          pass_td: (ex.pass_td ?? 0) + (s.pass_td ?? 0),
          pass_int: (ex.pass_int ?? 0) + (s.pass_int ?? 0),
          rush_att: (ex.rush_att ?? 0) + (s.rush_att ?? 0),
          rush_yd: (ex.rush_yd ?? 0) + (s.rush_yd ?? 0),
          rush_td: (ex.rush_td ?? 0) + (s.rush_td ?? 0),
          rec_tgt: (ex.rec_tgt ?? 0) + (s.rec_tgt ?? 0),
          rec: (ex.rec ?? 0) + (s.rec ?? 0),
          rec_yd: (ex.rec_yd ?? 0) + (s.rec_yd ?? 0),
          rec_td: (ex.rec_td ?? 0) + (s.rec_td ?? 0),
          fgm: (ex.fgm ?? 0) + (s.fgm ?? 0),
          fga: (ex.fga ?? 0) + (s.fga ?? 0),
          xpm: (ex.xpm ?? 0) + (s.xpm ?? 0),
          fum_lost: (ex.fum_lost ?? 0) + (s.fum_lost ?? 0),
        });
      }
    }

    const result = new Map<string, PlayerSeasonStats>();

    for (const [playerId, t] of totalsMap.entries()) {
      const gp = t.totalGames;
      if (!gp) continue;

      const hasPass = (t.pass_att ?? 0) > 0;
      const hasRush = (t.rush_att ?? 0) > 0;
      const hasRec = (t.rec ?? 0) > 0;
      const hasKick = (t.fgm ?? 0) > 0 || (t.fga ?? 0) > 0;

      result.set(playerId, {
        playerId,
        season,
        gamesPlayed: gp,

        ptsPerGame: {
          ppr: round1((t.pts_ppr ?? 0) / gp),
          half_ppr: round1((t.pts_half_ppr ?? 0) / gp),
          standard: round1((t.pts_std ?? 0) / gp),
        },
        totalPts: {
          ppr: round1(t.pts_ppr ?? 0),
          half_ppr: round1(t.pts_half_ppr ?? 0),
          standard: round1(t.pts_std ?? 0),
        },

        passAtt: hasPass ? (t.pass_att ?? 0) : null,
        passCmp: hasPass ? (t.pass_cmp ?? 0) : null,
        passCmpPct: hasPass ? pct(t.pass_cmp ?? 0, t.pass_att ?? 0) : null,
        passYds: hasPass ? (t.pass_yd ?? 0) : null,
        passYdsPg: hasPass ? pg(t.pass_yd ?? 0, gp) : null,
        passTds: hasPass ? (t.pass_td ?? 0) : null,
        passTdsPg: hasPass ? pg(t.pass_td ?? 0, gp) : null,
        passInts: hasPass ? (t.pass_int ?? 0) : null,

        rushAtt: hasRush ? (t.rush_att ?? 0) : null,
        rushYds: hasRush ? (t.rush_yd ?? 0) : null,
        rushYdsPg: hasRush ? pg(t.rush_yd ?? 0, gp) : null,
        rushYpc: hasRush ? ypu(t.rush_yd ?? 0, t.rush_att ?? 0) : null,
        rushTds: hasRush ? (t.rush_td ?? 0) : null,

        recTgts: hasRec ? (t.rec_tgt ?? null) : null,
        rec: hasRec ? (t.rec ?? 0) : null,
        recYds: hasRec ? (t.rec_yd ?? 0) : null,
        recYdsPg: hasRec ? pg(t.rec_yd ?? 0, gp) : null,
        recYpr: hasRec ? ypu(t.rec_yd ?? 0, t.rec ?? 0) : null,
        recTds: hasRec ? (t.rec_td ?? 0) : null,

        fgm: hasKick ? (t.fgm ?? 0) : null,
        fga: hasKick ? (t.fga ?? 0) : null,
        fgPct: hasKick ? pct(t.fgm ?? 0, t.fga ?? 0) : null,
        xpm: hasKick ? (t.xpm ?? 0) : null,

        fumbleLost: t.fum_lost ?? 0,
      });
    }

    this.cache.set(season, result);
    this.weeklyCache.set(season, weeklyMap);
    this.cacheLoadedAt.set(season, Date.now());
    this.logger.log(`Cached ${result.size} players for ${season}.`);
  }
}
