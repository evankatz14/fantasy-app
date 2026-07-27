import { useState } from 'react';
import type { Player, PlayerSeasonStats, ScoringFormat } from '../../types';
import { POSITION_COLORS } from '../PositionFilter';

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'DEF'] as const;
type PosFilter = (typeof POSITIONS)[number];

interface Props {
  availablePlayerIds: string[];
  nominatedPlayerId: string | null;
  players: Player[];
  stats: Record<string, PlayerSeasonStats>;
  playerValues: Record<string, number>;
  scoringFormat: ScoringFormat;
  onPlayerClick: (player: Player) => void;
  isNominationTurn?: boolean;
  onNominate?: (playerId: string, startingBid: number) => void;
}

export function AvailablePlayers({
  availablePlayerIds, nominatedPlayerId, players, stats, playerValues, scoringFormat,
  onPlayerClick, isNominationTurn, onNominate,
}: Props) {
  const [posFilter, setPosFilter] = useState<PosFilter>('ALL');
  const [pendingNomineeId, setPendingNomineeId] = useState<string | null>(null);
  const [nominationBid, setNominationBid] = useState('1');

  const playerMap = new Map(players.map(p => [p.id, p]));

  const visible = availablePlayerIds
    .map(id => playerMap.get(id))
    .filter((p): p is Player => !!p && (posFilter === 'ALL' || p.position === posFilter))
    .sort((a, b) => (playerValues[b.id] ?? 0) - (playerValues[a.id] ?? 0));

  return (
    <div className="flex flex-col h-full">
      <div className="flex-none pb-3 border-b border-slate-700/50">
        {isNominationTurn ? (
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse shrink-0" />
            <span className="text-sm font-semibold text-indigo-300">Your turn — pick a player to nominate</span>
          </div>
        ) : (
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
            Available Players <span className="text-slate-600">({availablePlayerIds.length})</span>
          </div>
        )}
        <div className="flex gap-1.5 flex-wrap">
          {POSITIONS.map(pos => (
            <button
              key={pos}
              onClick={() => setPosFilter(pos)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                pos === 'ALL'
                  ? POSITION_COLORS['ALL']
                  : (POSITION_COLORS[pos as keyof typeof POSITION_COLORS] ?? POSITION_COLORS['ALL'])
              } ${posFilter === pos ? 'opacity-100 ring-1 ring-white/20' : 'opacity-40 hover:opacity-70'}`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto mt-3 space-y-1 pr-1">
        {visible.length === 0 && (
          <div className="text-slate-600 text-sm text-center pt-8">No players available</div>
        )}
        {visible.map(player => {
          const s = stats[player.id];
          const ppg = s?.ptsPerGame[scoringFormat];
          const val = playerValues[player.id];
          const isNominated = player.id === nominatedPlayerId;
          const isPending = player.id === pendingNomineeId;
          const posColor = POSITION_COLORS[player.position] ?? POSITION_COLORS['ALL'];

          function confirmNomination(e: React.MouseEvent) {
            e.stopPropagation();
            const bid = parseInt(nominationBid, 10);
            if (!isNaN(bid) && bid >= 1 && onNominate) {
              onNominate(player.id, bid);
              setPendingNomineeId(null);
              setNominationBid('1');
            }
          }

          return (
            <div
              key={player.id}
              className={`rounded-lg border transition-colors ${
                isPending
                  ? 'bg-indigo-900/30 border-indigo-500/60'
                  : isNominated
                  ? 'bg-indigo-600/20 border-indigo-500/50'
                  : 'bg-slate-800/50 border-slate-700/30'
              }`}
            >
              {/* Main row */}
              <div
                onClick={() => !isPending && onPlayerClick(player)}
                className={`flex items-center gap-2 px-3 py-2 ${!isPending ? 'cursor-pointer hover:bg-slate-700/30 rounded-lg' : ''}`}
              >
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded border shrink-0 ${posColor}`}>
                  {player.position}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-200 truncate">{player.fullName}</div>
                  {player.team && <div className="text-xs text-slate-500">{player.team}</div>}
                </div>
                <div className="text-right shrink-0">
                  {val != null && (
                    <div className="text-xs font-semibold text-emerald-500/80">${val}</div>
                  )}
                  {ppg != null && (
                    <div className="text-xs text-slate-500">{ppg} ppg</div>
                  )}
                </div>
                {isNominated ? (
                  <span className="text-xs text-indigo-400 font-semibold shrink-0">On clock</span>
                ) : isNominationTurn && onNominate && !isPending ? (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setPendingNomineeId(player.id);
                      setNominationBid('1');
                    }}
                    className="shrink-0 px-2 py-1 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
                  >
                    Nominate
                  </button>
                ) : null}
              </div>

              {/* Inline bid entry — only shown for the pending nominee */}
              {isPending && (
                <div
                  onClick={e => e.stopPropagation()}
                  className="flex items-center gap-2 px-3 pb-2.5"
                >
                  <span className="text-xs text-slate-400 shrink-0">Starting bid:</span>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                    <input
                      type="number"
                      min={1}
                      value={nominationBid}
                      onChange={e => setNominationBid(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && confirmNomination(e as unknown as React.MouseEvent)}
                      autoFocus
                      className="w-20 pl-5 pr-2 py-1 bg-slate-800 border border-slate-600 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <button
                    onClick={confirmNomination}
                    className="px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setPendingNomineeId(null); }}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
