import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useAuctionStore, HUMAN_TEAM_ID } from '../../store/useAuctionStore';
import { computeAuctionValues } from '../../utils/auctionValues';
import { fetchPlayerRankings } from '../../api';
import { getAIBid, maxBid, PERSONALITY_DELAY } from '../../utils/auctionAI';
import type { AIPersonality } from '../../utils/auctionAI';
import { BiddingPanel } from './BiddingPanel';
import { AvailablePlayers } from './AvailablePlayers';
import { RosterPanel } from './RosterPanel';

const ELIGIBLE_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'DEF']);
const TIMER_SECONDS = 10;
const SKIP_TIMER_SECONDS = 3; // shortened countdown after "I'm Out"

interface Props {
  onBack: () => void;
}

export function AuctionRoom({ onBack }: Props) {
  const { players, stats, leagues, activeLeagueId } = useAppStore();
  const {
    phase, teams, nominatedPlayerId, nominatorTeamId,
    currentBid, currentHighBidderTeamId, bidSequence,
    availablePlayerIds, auctionLog, playerValues, lastAwarded,
    startAuction, doNominate, placeBid, awardPlayer, resetAuction,
  } = useAuctionStore();

  const activeLeague = leagues.find(l => l.id === activeLeagueId);
  const scoringFormat = activeLeague?.scoringFormat ?? 'half_ppr';

  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [isSkipping, setIsSkipping] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Ref so timeout callbacks can read current skip state without stale closures
  const isSkippingRef = useRef(false);

  const humanTeam = teams.find(t => t.isHuman) ?? teams[0];
  const nominatedPlayer = players.find(p => p.id === nominatedPlayerId);
  const nominator = teams.find(t => t.id === nominatorTeamId);
  const highBidder = teams.find(t => t.id === currentHighBidderTeamId);

  const lastAwardedResolved = (() => {
    if (!lastAwarded) return null;
    const player = players.find(p => p.id === lastAwarded.playerId);
    const winner = teams.find(t => t.id === lastAwarded.winnerTeamId);
    if (!player || !winner) return null;
    return { player, winner, price: lastAwarded.price };
  })();

  // ── Start auction ────────────────────────────────────────────────────────
  async function handleStart() {
    const playerIds = players
      .filter(p => ELIGIBLE_POSITIONS.has(p.position))
      .map(p => p.id);

    const resolvedRankings = await fetchPlayerRankings(scoringFormat).catch(() => []);
    const values = computeAuctionValues(players, stats, scoringFormat, resolvedRankings);
    startAuction(playerIds, values);
    useAuctionStore.getState().doNominate(players);
  }

  // ── Reset skip state whenever a new player is nominated ─────────────────
  useEffect(() => {
    setIsSkipping(false);
    isSkippingRef.current = false;
  }, [nominatedPlayerId]);

  // ── Timer: resets on every bid; shorter countdown in skip mode ───────────
  useEffect(() => {
    if (phase !== 'bidding') return;
    const resetTo = isSkippingRef.current ? SKIP_TIMER_SECONDS : TIMER_SECONDS;
    setTimeLeft(resetTo);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          useAuctionStore.getState().awardPlayer(players);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [bidSequence]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── AI bid scheduling: fast delays in skip mode, normal delays otherwise ─
  useEffect(() => {
    if (phase !== 'bidding' || !nominatedPlayerId) return;

    aiTimeouts.current.forEach(clearTimeout);
    aiTimeouts.current = [];

    const snap = useAuctionStore.getState();
    const player = players.find(p => p.id === nominatedPlayerId);
    if (!player) return;

    snap.teams
      .filter(t => !t.isHuman && t.id !== snap.currentHighBidderTeamId)
      .forEach(team => {
        const bid = getAIBid(team, player, snap.currentBid, snap.playerValues);
        if (bid === null) return;

        const delay = isSkippingRef.current
          ? 150 + Math.random() * 250
          : (() => { const [mn, mx] = PERSONALITY_DELAY[team.personality as AIPersonality]; return mn + Math.random() * (mx - mn); })();

        const timeout = setTimeout(() => {
          const fresh = useAuctionStore.getState();
          if (fresh.phase !== 'bidding') return;
          const freshBid = getAIBid(team, player, fresh.currentBid, fresh.playerValues);
          if (freshBid !== null && fresh.currentHighBidderTeamId !== team.id) {
            fresh.placeBid(team.id, freshBid);
          }
        }, delay);

        aiTimeouts.current.push(timeout);
      });

    return () => {
      aiTimeouts.current.forEach(clearTimeout);
      aiTimeouts.current = [];
    };
  }, [bidSequence, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Awarding → auto-nominate next player ─────────────────────────────────
  useEffect(() => {
    if (phase !== 'awarding') return;
    const t = setTimeout(() => {
      useAuctionStore.getState().doNominate(players);
    }, 2500);
    return () => clearTimeout(t);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      aiTimeouts.current.forEach(clearTimeout);
    };
  }, []);

  // ── Skip: clear normal timers, re-schedule AIs in fast mode ─────────────
  function handleSkip() {
    if (isSkippingRef.current || phase !== 'bidding') return;
    isSkippingRef.current = true;
    setIsSkipping(true);

    // Cancel existing slow AI timeouts and the current timer
    aiTimeouts.current.forEach(clearTimeout);
    aiTimeouts.current = [];
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    const snap = useAuctionStore.getState();
    const player = players.find(p => p.id === snap.nominatedPlayerId);

    if (!player) {
      snap.awardPlayer(players);
      return;
    }

    // Re-schedule all interested AI teams with fast staggered delays
    let baseDelay = 0;
    snap.teams
      .filter(t => !t.isHuman && t.id !== snap.currentHighBidderTeamId)
      .forEach(team => {
        if (getAIBid(team, player, snap.currentBid, snap.playerValues) === null) return;
        baseDelay += 150 + Math.random() * 200;
        const timeout = setTimeout(() => {
          const fresh = useAuctionStore.getState();
          if (fresh.phase !== 'bidding') return;
          const freshBid = getAIBid(team, player, fresh.currentBid, fresh.playerValues);
          if (freshBid !== null && fresh.currentHighBidderTeamId !== team.id) {
            fresh.placeBid(team.id, freshBid);
          }
        }, baseDelay);
        aiTimeouts.current.push(timeout);
      });

    // Start a short 4s countdown — if AIs finish bidding before this, the
    // per-bid timer reset (SKIP_TIMER_SECONDS) handles the final countdown.
    setTimeLeft(SKIP_TIMER_SECONDS);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          useAuctionStore.getState().awardPlayer(players);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  const isStarted = phase !== 'idle';

  return (
    <div className="h-screen flex flex-col bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="flex-none px-6 py-4 border-b border-slate-700/40 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => { resetAuction(); onBack(); }}
            className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer flex items-center gap-1.5 text-sm"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="10" y1="3" x2="4" y2="8" /><line x1="4" y1="8" x2="10" y2="13" />
            </svg>
            Rankings
          </button>
          <h1 className="text-xl font-bold text-white">Mock Auction</h1>
          {isStarted && (
            <span className="text-xs text-slate-500">
              {auctionLog.length} sold · ${humanTeam.budget} remaining
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isStarted && phase !== 'complete' && (
            <button
              onClick={resetAuction}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors cursor-pointer"
            >
              Restart
            </button>
          )}
          {!isStarted && (
            <button
              onClick={handleStart}
              disabled={!players.length}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-40"
            >
              Start Auction
            </button>
          )}
        </div>
      </div>

      {/* Pre-start splash */}
      {!isStarted && (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 text-center px-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">12-Team Mock Auction</h2>
            <p className="text-slate-400 max-w-md text-sm leading-relaxed">
              $200 budget · 15 roster spots (QB, 2RB, 2WR, TE, FLEX, DEF + 7 bench).
              You control one team; 11 AI managers compete against you.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm max-w-xl w-full">
            {[
              { label: 'Aggressive ×3', desc: 'Bids up to 115% of value, reacts quickly.' },
              { label: 'Balanced ×5', desc: 'Bids at fair value, steady competition.' },
              { label: 'Conservative ×3', desc: 'Bids to 82% of value, hoards budget.' },
            ].map(({ label, desc }) => (
              <div key={label} className="bg-slate-800 rounded-xl p-4 border border-slate-700 text-left">
                <div className="font-semibold text-slate-200 mb-1.5">{label}</div>
                <div className="text-slate-500 text-xs leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>
          <button
            onClick={handleStart}
            disabled={!players.length}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-40 text-base"
          >
            {players.length ? 'Start Auction' : 'Loading players…'}
          </button>
        </div>
      )}

      {/* 3-panel layout */}
      {isStarted && (
        <div className="flex-1 overflow-hidden grid grid-cols-[290px_1fr_290px] divide-x divide-slate-700/40">
          <div className="p-5 overflow-y-auto">
            <BiddingPanel
              phase={phase}
              nominatedPlayer={nominatedPlayer}
              currentBid={currentBid}
              highBidder={highBidder}
              nominator={nominator}
              humanTeam={humanTeam}
              humanMaxBid={maxBid(humanTeam)}
              timeLeft={timeLeft}
              playerValue={nominatedPlayerId ? playerValues[nominatedPlayerId] : undefined}
              stats={nominatedPlayer ? stats[nominatedPlayer.id] : undefined}
              scoringFormat={scoringFormat}
              lastAwarded={lastAwardedResolved}
              isSkipping={isSkipping}
              onPlaceBid={amount => placeBid(HUMAN_TEAM_ID, amount)}
              onSkip={handleSkip}
            />
          </div>
          <div className="p-5 overflow-hidden flex flex-col">
            <AvailablePlayers
              availablePlayerIds={availablePlayerIds}
              nominatedPlayerId={nominatedPlayerId}
              players={players}
              stats={stats}
              playerValues={playerValues}
              scoringFormat={scoringFormat}
            />
          </div>
          <div className="p-5 overflow-hidden flex flex-col">
            <RosterPanel
              teams={teams}
              players={players}
              humanTeamId={HUMAN_TEAM_ID}
              auctionLog={auctionLog}
              phase={phase}
            />
          </div>
        </div>
      )}
    </div>
  );
}
