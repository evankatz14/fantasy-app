import { useState } from 'react';
import type { Player, PlayerSeasonStats, ScoringFormat } from '../../types';
import type { AuctionPhase, AuctionTeam } from '../../store/useAuctionStore';
import { POSITION_COLORS } from '../PositionFilter';

interface Props {
  phase: AuctionPhase;
  nominatedPlayer: Player | undefined;
  currentBid: number;
  highBidder: AuctionTeam | undefined;
  nominator: AuctionTeam | undefined;
  humanTeam: AuctionTeam;
  humanMaxBid: number;
  timeLeft: number;
  playerValue: number | undefined;
  stats: PlayerSeasonStats | undefined;
  scoringFormat: ScoringFormat;
  lastAwarded: { player: Player; winner: AuctionTeam; price: number } | null;
  isSkipping: boolean;
  onPlaceBid: (amount: number) => void;
  onSkip: () => void;
}

export function BiddingPanel({
  phase, nominatedPlayer, currentBid, highBidder, nominator,
  humanTeam, humanMaxBid, timeLeft, playerValue, stats, scoringFormat,
  lastAwarded, isSkipping, onPlaceBid, onSkip,
}: Props) {
  const [customBid, setCustomBid] = useState('');

  const minBid = currentBid + 1;
  const canBid = humanTeam.budget > 0 &&
    humanTeam.roster.some(s => s.playerId === null) &&
    minBid <= humanMaxBid &&
    phase === 'bidding';
  const isWinning = highBidder?.id === humanTeam.id;

  const timerColor = timeLeft <= 3 ? 'text-red-400' : timeLeft <= 6 ? 'text-yellow-400' : 'text-emerald-400';

  function handleCustomBid() {
    const amount = parseInt(customBid, 10);
    if (isNaN(amount) || amount < minBid || amount > humanMaxBid) return;
    onPlaceBid(amount);
    setCustomBid('');
  }

  // ── Awarding state ────────────────────────────────────────────────────────
  if (phase === 'awarding' && lastAwarded) {
    const posColor = POSITION_COLORS[lastAwarded.player.position] ?? POSITION_COLORS['ALL'];
    const isHumanWin = lastAwarded.winner.id === humanTeam.id;
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
        <div className={`text-4xl font-bold ${isHumanWin ? 'text-emerald-400' : 'text-slate-300'}`}>
          {isHumanWin ? '🏆 You won!' : 'Sold!'}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-1 rounded border ${posColor}`}>
            {lastAwarded.player.position}
          </span>
          <span className="text-xl font-semibold text-white">{lastAwarded.player.fullName}</span>
        </div>
        <div className="text-3xl font-bold text-emerald-400">${lastAwarded.price}</div>
        <div className="text-slate-400 text-sm">
          {isHumanWin ? 'Added to your roster' : `Won by ${lastAwarded.winner.name}`}
        </div>
        <div className="text-xs text-slate-600 mt-2">Next nomination coming up…</div>
      </div>
    );
  }

  // ── Complete state ────────────────────────────────────────────────────────
  if (phase === 'complete') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
        <div className="text-3xl font-bold text-indigo-300">Auction Complete!</div>
        <div className="text-slate-400 text-sm">All roster spots have been filled.</div>
        <div className="text-slate-300 text-lg font-semibold mt-2">
          ${humanTeam.budget} remaining budget
        </div>
      </div>
    );
  }

  // ── Idle / no player nominated yet ───────────────────────────────────────
  if (phase === 'idle' || !nominatedPlayer) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <div className="text-sm">Waiting for nomination…</div>
      </div>
    );
  }

  // ── Active bidding ────────────────────────────────────────────────────────
  const posColor = POSITION_COLORS[nominatedPlayer.position] ?? POSITION_COLORS['ALL'];
  const ppg = stats?.ptsPerGame[scoringFormat];

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Nominated player */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <div className="text-xs text-slate-500 mb-2 uppercase tracking-wider">
          Up for bid · nominated by {nominator?.name ?? '—'}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold px-2 py-1 rounded border shrink-0 ${posColor}`}>
            {nominatedPlayer.position}
          </span>
          <div>
            <div className="text-lg font-bold text-white">{nominatedPlayer.fullName}</div>
            <div className="text-sm text-slate-400">{nominatedPlayer.team ?? 'FA'}</div>
          </div>
        </div>
        {(ppg != null || playerValue != null) && (
          <div className="flex gap-4 mt-3 pt-3 border-t border-slate-700/50 text-xs text-slate-500">
            {ppg != null && <span>{ppg} PPG ({scoringFormat.replace('_', ' ')})</span>}
            {playerValue != null && <span className="text-emerald-500/80">Est. value: ${playerValue}</span>}
          </div>
        )}
      </div>

      {/* Current bid */}
      <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Current bid</div>
            <div className="text-4xl font-bold text-white">${currentBid}</div>
            <div className={`text-sm mt-1 ${isWinning ? 'text-emerald-400 font-semibold' : 'text-slate-400'}`}>
              {isWinning ? '✓ You are winning' : `${highBidder?.name ?? '—'} is winning`}
            </div>
          </div>
          {/* Timer */}
          <div className="text-right">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Time left</div>
            <div className={`text-4xl font-bold tabular-nums ${timerColor}`}>{timeLeft}s</div>
            {/* Timer bar */}
            <div className="w-24 h-1.5 bg-slate-700 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  timeLeft <= 3 ? 'bg-red-500' : timeLeft <= 6 ? 'bg-yellow-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${(timeLeft / 10) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bid controls */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Your budget: <span className="text-slate-300 font-semibold">${humanTeam.budget}</span></span>
          <span>Max bid: <span className="text-slate-300 font-semibold">${humanMaxBid}</span></span>
        </div>

        {/* Min bid button */}
        <button
          onClick={() => onPlaceBid(minBid)}
          disabled={!canBid}
          className="w-full py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-slate-700"
        >
          Bid ${minBid} <span className="font-normal text-indigo-300/80">(+$1 min)</span>
        </button>

        {/* Custom bid */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
            <input
              type="number"
              min={minBid}
              max={humanMaxBid}
              value={customBid}
              onChange={e => setCustomBid(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCustomBid()}
              placeholder={`${minBid}–${humanMaxBid}`}
              disabled={!canBid}
              className="w-full pl-6 pr-3 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 disabled:opacity-30"
            />
          </div>
          <button
            onClick={handleCustomBid}
            disabled={!canBid || !customBid}
            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            Bid
          </button>
        </div>
      </div>

      {/* Skip / I'm Out */}
      {!isSkipping ? (
        <button
          onClick={onSkip}
          className="w-full py-2 rounded-xl text-sm font-medium border border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
        >
          I'm Out — Skip to Result
        </button>
      ) : (
        <div className="flex items-center justify-center gap-2 py-2 text-xs text-slate-500">
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Resolving…
        </div>
      )}

      {/* Empty slots */}
      <div className="text-xs text-slate-600 text-center">
        {humanTeam.roster.filter(s => s.playerId === null).length} roster spots remaining
      </div>
    </div>
  );
}
