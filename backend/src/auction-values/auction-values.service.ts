import { Injectable, Logger } from '@nestjs/common';

export interface PlayerRanking {
  playerName: string;
  firstName: string;
  lastName: string;
  position: string;   // QB RB WR TE DEF
  team: string;       // ATL, KC, etc.
  overallRank: number;
  positionRank: number;
  tier: number;
}

type ScoringFormat = 'half_ppr' | 'ppr' | 'standard';

const RANKING_URLS: Record<ScoringFormat, string> = {
  half_ppr: 'https://www.fantasypros.com/nfl/rankings/half-point-ppr-cheatsheets.php',
  ppr:      'https://www.fantasypros.com/nfl/rankings/ppr-cheatsheets.php',
  standard: 'https://www.fantasypros.com/nfl/rankings/consensus-cheatsheets.php',
};

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

interface CacheEntry {
  data: PlayerRanking[];
  fetchedAt: number;
}

@Injectable()
export class AuctionValuesService {
  private readonly logger = new Logger(AuctionValuesService.name);
  private cache = new Map<ScoringFormat, CacheEntry>();

  async getValues(format: ScoringFormat = 'half_ppr'): Promise<PlayerRanking[]> {
    const cached = this.cache.get(format);
    if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
      return cached.data;
    }

    try {
      const data = await this.scrapeRankings(format);
      this.cache.set(format, { data, fetchedAt: Date.now() });
      this.logger.log(`Fetched ${data.length} ECR rankings for ${format}`);
      return data;
    } catch (err) {
      this.logger.warn(`Rankings scrape failed for ${format}: ${err}`);
      return cached?.data ?? [];
    }
  }

  private async scrapeRankings(format: ScoringFormat): Promise<PlayerRanking[]> {
    const url = RANKING_URLS[format];
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    return this.parseECRData(html);
  }

  private parseECRData(html: string): PlayerRanking[] {
    // FantasyPros embeds: var ecrData = {...};
    const match = html.match(/var\s+ecrData\s*=\s*(\{[\s\S]*?\});\s*(?:var\s+|<\/script>)/);
    if (!match) {
      this.logger.warn('ecrData not found in rankings page HTML');
      return [];
    }

    let data: any;
    try { data = JSON.parse(match[1]); } catch (e) {
      this.logger.warn(`Failed to parse ecrData JSON: ${e}`);
      return [];
    }

    const players: any[] = data?.players ?? [];
    const results: PlayerRanking[] = [];

    for (const p of players) {
      const playerName: string = p.player_name ?? '';
      const pos = this.mapPosition(p.player_position_id ?? p.player_positions ?? '');
      if (!playerName || !pos) continue;

      const overallRank = parseFloat(String(p.rank_ecr ?? p.rank_ave ?? '999'));
      const positionRank = this.parsePosRank(p.pos_rank ?? '');
      const tier = Number(p.tier ?? 99);
      const team = String(p.player_team_id ?? '');

      const { firstName, lastName } = splitName(playerName);
      results.push({ playerName, firstName, lastName, position: pos, team, overallRank, positionRank, tier });
    }

    return results;
  }

  private mapPosition(raw: string): string {
    const upper = (raw ?? '').toUpperCase();
    if (upper === 'DST') return 'DEF';
    if (['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(upper)) return upper;
    return '';
  }

  private parsePosRank(posRank: string): number {
    const m = String(posRank).match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 999;
  }
}

// ── Name utilities ────────────────────────────────────────────────────────────

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

export function splitName(fullName: string): { firstName: string; lastName: string } {
  const norm = normalizeName(fullName);
  const idx = norm.indexOf(' ');
  if (idx === -1) return { firstName: norm, lastName: '' };
  return { firstName: norm.slice(0, idx), lastName: norm.slice(idx + 1) };
}
