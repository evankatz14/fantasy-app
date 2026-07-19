import type { Player, PlayerSeasonStats, ScoringFormat, ScoringSettings } from '../types';
import type { AuctionPrice } from '../store/useAppStore';
import { calcCustomPpg } from '../utils/scoring';
import { POSITION_COLORS } from './PositionFilter';

interface Props {
  player: Player;
  rank: number;
  tier: number;
  stats?: PlayerSeasonStats;
  scoringFormat?: ScoringFormat;
  scoringSettings?: ScoringSettings;
  auctionPrice?: AuctionPrice;
  showStats?: boolean;
  onClick?: () => void;
}

const INJURY_COLORS: Record<string, string> = {
  Out: 'text-red-400',
  Doubtful: 'text-red-400',
  Questionable: 'text-yellow-400',
  Probable: 'text-green-400',
};

function StatLine({ player, stats }: { player: Player; stats: PlayerSeasonStats }) {
  const parts: string[] = [];
  switch (player.position) {
    case 'QB':
      if (stats.passYdsPg != null) parts.push(`${stats.passYdsPg} py/g`);
      if (stats.passTdsPg != null) parts.push(`${stats.passTdsPg} ptd/g`);
      if (stats.rushYdsPg != null && stats.rushYdsPg > 5) parts.push(`${stats.rushYdsPg} ry/g`);
      break;
    case 'RB':
      if (stats.rushYdsPg != null) parts.push(`${stats.rushYdsPg} ry/g`);
      if (stats.rec != null) parts.push(`${stats.rec} rec`);
      if (stats.rushTds != null || stats.recTds != null)
        parts.push(`${((stats.rushTds ?? 0) + (stats.recTds ?? 0))} td`);
      break;
    case 'WR':
    case 'TE':
      if (stats.rec != null) parts.push(`${stats.rec} rec`);
      if (stats.recYdsPg != null) parts.push(`${stats.recYdsPg} ry/g`);
      if (stats.recTds != null) parts.push(`${stats.recTds} td`);
      break;
    case 'K':
      if (stats.fgm != null && stats.fga != null)
        parts.push(`${stats.fgm}/${stats.fga} fg`);
      break;
  }
  if (!parts.length) return null;
  return <span className="text-slate-500 text-xs">{parts.join(' · ')}</span>;
}

export function PlayerCard({
  player, rank, tier: _tier, stats, scoringFormat = 'half_ppr', scoringSettings, auctionPrice, showStats = true, onClick,
}: Props) {
  const posColor = POSITION_COLORS[player.position] ?? POSITION_COLORS['ALL'];

  let ppg: number | null = null;
  let ppgLabel = 'PPG';
  if (stats) {
    if (scoringSettings) {
      ppg = calcCustomPpg(stats, scoringSettings);
      ppgLabel = 'Custom PPG';
    } else {
      ppg = stats.ptsPerGame[scoringFormat];
    }
  }

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-2 min-h-12.5 bg-slate-800/60 border border-slate-700/50 rounded-lg transition-colors ${
        onClick ? 'cursor-pointer hover:bg-slate-700/80 hover:border-slate-600' : 'hover:bg-slate-700/60'
      }`}
    >
      <span className="w-8 text-right text-slate-500 text-sm font-mono shrink-0">{rank}</span>

      <span className={`w-10 text-center text-xs font-bold px-1.5 py-0.5 rounded border ${posColor} shrink-0`}>
        {player.position}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-semibold text-slate-100 truncate">{player.fullName}</span>
          {player.team && <span className="text-xs text-slate-400 shrink-0">{player.team}</span>}
          {showStats && stats && <StatLine player={player} stats={stats} />}
        </div>
        {showStats && stats && ppg != null && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs font-semibold text-indigo-400">{ppg} {ppgLabel}</span>
            <span className="text-xs text-slate-600">{stats.gamesPlayed}g · {stats.season}</span>
          </div>
        )}
      </div>

      {auctionPrice && (auctionPrice.min != null || auctionPrice.max != null) && (
        <span className="text-xs font-mono font-semibold text-emerald-400 shrink-0 bg-emerald-400/10 px-1.5 py-0.5 rounded">
          {auctionPrice.min != null && auctionPrice.max != null
            ? `$${auctionPrice.min}–${auctionPrice.max}`
            : auctionPrice.min != null
              ? `$${auctionPrice.min}+`
              : `≤$${auctionPrice.max}`}
        </span>
      )}

      {player.age && <span className="text-xs text-slate-500 shrink-0">Age {player.age}</span>}

      {player.injuryStatus && (
        <span className={`text-xs shrink-0 ${INJURY_COLORS[player.injuryStatus] ?? 'text-slate-400'}`}>
          {player.injuryStatus}
        </span>
      )}
    </div>
  );
}
