import { Injectable, Logger } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

export interface YahooPlayerValue {
  playerName: string;
  firstName: string;
  lastName: string;
  position: string;    // QB RB WR TE DEF K
  team: string;
  averageCost: number | null;    // auction AAV in dollars
  averagePick: number | null;    // ADP for snake drafts
  percentDrafted: number | null;
}

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const YAHOO_API = 'https://fantasysports.yahooapis.com/fantasy/v2';
const BATCH_SIZE = 25;
const MAX_PLAYERS = 400;

@Injectable()
export class YahooService {
  private readonly logger = new Logger(YahooService.name);
  private cache: { data: YahooPlayerValue[]; fetchedAt: number } | null = null;

  constructor(private readonly authService: AuthService) {}

  async getPlayerValues(): Promise<YahooPlayerValue[]> {
    if (this.cache && Date.now() - this.cache.fetchedAt < TTL_MS) {
      return this.cache.data;
    }

    const token = await this.authService.getValidAccessToken();
    const data = await this.fetchAllPlayers(token);
    this.cache = { data, fetchedAt: Date.now() };
    this.logger.log(`Cached ${data.length} Yahoo player values`);
    return data;
  }

  private async fetchAllPlayers(token: string): Promise<YahooPlayerValue[]> {
    const results: YahooPlayerValue[] = [];
    let start = 0;

    while (start < MAX_PLAYERS) {
      const url = `${YAHOO_API}/game/nfl/players;sort=AR;start=${start};count=${BATCH_SIZE};out=draft_analysis?format=json`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        this.logger.warn(`Yahoo players fetch failed at start=${start}: ${res.status}`);
        break;
      }

      const json = await res.json();
      const batch = this.parseBatch(json);
      results.push(...batch);
      this.logger.debug(`Fetched ${batch.length} players (start=${start})`);

      if (batch.length < BATCH_SIZE) break;
      start += BATCH_SIZE;
    }

    return results;
  }

  // Yahoo's response structure:
  // fantasy_content.game[1].players.{idx}.player[ [info array], {draft_analysis} ]
  private parseBatch(json: any): YahooPlayerValue[] {
    const results: YahooPlayerValue[] = [];
    try {
      const players = json?.fantasy_content?.game?.[1]?.players;
      if (!players) return results;

      const count = Number(players.count ?? 0);
      for (let i = 0; i < count; i++) {
        const entry = players[String(i)]?.player;
        if (!Array.isArray(entry) || entry.length < 2) continue;

        const infoArr: any[] = entry[0];
        const extras: any = entry[1] ?? {};

        // Info array contains objects with different keys
        const info: any = {};
        for (const item of infoArr) {
          if (item && typeof item === 'object') Object.assign(info, item);
        }

        const nameObj = info.name ?? {};
        const fullName: string = nameObj.full ?? '';
        const firstName: string = nameObj.first ?? '';
        const lastName: string = nameObj.last ?? '';
        const pos = this.mapPosition(info.display_position ?? info.primary_position ?? '');
        const team = info.editorial_team_abbr ?? '';

        if (!fullName || !pos) continue;

        const da = extras?.draft_analysis ?? {};
        const averageCost = da.average_cost != null ? parseFloat(da.average_cost) : null;
        const averagePick = da.average_pick != null ? parseFloat(da.average_pick) : null;
        const percentDrafted = da.percent_drafted != null ? parseFloat(da.percent_drafted) : null;

        results.push({
          playerName: fullName,
          firstName: normalizeName(firstName || fullName.split(' ')[0]),
          lastName: normalizeName(lastName || fullName.split(' ').slice(1).join(' ')),
          position: pos,
          team,
          averageCost,
          averagePick,
          percentDrafted,
        });
      }
    } catch (err) {
      this.logger.warn(`Error parsing Yahoo batch: ${err}`);
    }
    return results;
  }

  private mapPosition(raw: string): string {
    const upper = (raw ?? '').split(',')[0].trim().toUpperCase();
    if (upper === 'DST' || upper === 'DEF') return 'DEF';
    if (['QB', 'RB', 'WR', 'TE', 'K'].includes(upper)) return upper;
    return '';
  }
}

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
