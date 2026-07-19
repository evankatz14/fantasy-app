import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Player, SleeperPlayer, FantasyPosition } from './player.types';

const FANTASY_POSITIONS = new Set<string>(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);
const SLEEPER_PLAYERS_URL = 'https://api.sleeper.app/v1/players/nfl';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class PlayersService implements OnModuleInit {
  private readonly logger = new Logger(PlayersService.name);
  private cache: Player[] = [];
  private cacheLoadedAt: number | null = null;

  constructor(private readonly http: HttpService) {}

  async onModuleInit() {
    await this.loadPlayers();
  }

  async getPlayers(position?: FantasyPosition): Promise<Player[]> {
    if (!this.isCacheValid()) {
      await this.loadPlayers();
    }
    if (position) {
      return this.cache.filter((p) => p.position === position);
    }
    return this.cache;
  }

  async refreshPlayers(): Promise<void> {
    this.cacheLoadedAt = null;
    await this.loadPlayers();
  }

  private isCacheValid(): boolean {
    return (
      this.cacheLoadedAt !== null &&
      Date.now() - this.cacheLoadedAt < CACHE_TTL_MS
    );
  }

  private async loadPlayers(): Promise<void> {
    this.logger.log('Fetching players from Sleeper API...');
    const response = await firstValueFrom(
      this.http.get<Record<string, SleeperPlayer>>(SLEEPER_PLAYERS_URL),
    );

    const raw = response.data;
    const players: Player[] = [];

    for (const [id, p] of Object.entries(raw)) {
      const positions: string[] = p.fantasy_positions ?? (p.position ? [p.position] : []);
      const fantasyPos = positions.find((pos) => FANTASY_POSITIONS.has(pos));
      if (!fantasyPos) continue;

      // Only keep players on an active NFL roster
      if (!p.team) continue;

      players.push({
        id,
        firstName: p.first_name ?? '',
        lastName: p.last_name ?? '',
        fullName: p.full_name ?? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(),
        position: fantasyPos as FantasyPosition,
        team: p.team ?? null,
        age: p.age ?? null,
        yearsExp: p.years_exp ?? null,
        injuryStatus: p.injury_status ?? null,
        status: p.status ?? null,
        number: p.number ?? null,
        depthChartPosition: p.depth_chart_position ?? null,
      });
    }

    // Sort by search_rank from Sleeper, falling back to alphabetical
    const rankMap = new Map<string, number>();
    for (const [id, p] of Object.entries(raw)) {
      if (p.search_rank != null) rankMap.set(id, p.search_rank);
    }
    players.sort((a, b) => {
      const ra = rankMap.get(a.id) ?? 999999;
      const rb = rankMap.get(b.id) ?? 999999;
      return ra - rb;
    });

    this.cache = players;
    this.cacheLoadedAt = Date.now();
    this.logger.log(`Cached ${players.length} fantasy-relevant players.`);
  }
}
