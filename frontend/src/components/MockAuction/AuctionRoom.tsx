import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useAuctionStore, HUMAN_TEAM_ID } from '../../store/useAuctionStore';
import { computeAuctionValues, computeAuctionRanges } from '../../utils/auctionValues';
import { fetchPlayerRankings } from '../../api';
import { getAIBid, maxBid, PERSONALITY_DELAY, nominationChoice } from '../../utils/auctionAI';
import type { AIPersonality } from '../../utils/auctionAI';
import { BiddingPanel } from './BiddingPanel';
import { AvailablePlayers } from './AvailablePlayers';
import { RosterPanel } from './RosterPanel';
import { PlayerModal } from '../PlayerModal';
import type { Player, RosterSlots } from '../../types';

function eligiblePositionsFromSlots(slots: RosterSlots): Set<string> {
  const pos = new Set<string>();
  if (slots.QB > 0) pos.add('QB');
  if (slots.RB > 0) pos.add('RB');
  if (slots.WR > 0) pos.add('WR');
  if (slots.TE > 0) pos.add('TE');
  if (slots.DEF > 0) pos.add('DEF');
  if (slots.K > 0) pos.add('K');
  if (slots.FLEX > 0) { pos.add('RB'); pos.add('WR'); pos.add('TE'); }
  if (slots.SFLEX > 0) { pos.add('QB'); pos.add('RB'); pos.add('WR'); pos.add('TE'); }
  return pos;
}

const DEFAULT_ELIGIBLE = new Set(['QB', 'RB', 'WR', 'TE', 'DEF']);
const TIMER_SECONDS = 10;
const SKIP_TIMER_SECONDS = 3;
const NOMINATION_TIMER_SECONDS = 30;

interface Props {
  onBack: () => void;
}

export function AuctionRoom({ onBack }: Props) {
  const { players, stats, leagues, activeLeagueId } = useAppStore();
  const {
    phase, teams, nominatedPlayerId, nominatorTeamId,
    currentBid, currentHighBidderTeamId, bidSequence,
    availablePlayerIds, auctionLog, playerValues, lastAwarded,
    startAuction, humanNominate, placeBid, resetAuction,
  } = useAuctionStore();

  const activeLeague = leagues.find(l => l.id === activeLeagueId);
  const scoringFormat = activeLeague?.scoringFormat ?? 'half_ppr';
  const leagueTeamCount = activeLeague?.teamCount ?? 12;
  const leagueBudget = activeLeague?.auctionBudget ?? 200;
  const leagueSlots = activeLeague?.rosterSlots;
  const eligiblePositions = leagueSlots ? eligiblePositionsFromSlots(leagueSlots) : DEFAULT_ELIGIBLE;

  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [isSkipping, setIsSkipping] = useState(false);
  const [modalPlayer, setModalPlayer] = useState<Player | null>(null);
  const [nominationPosition, setNominationPosition] = useState(() => 1 + Math.floor(Math.random() * leagueTeamCount));
  const [nominationTimeLeft, setNominationTimeLeft] = useState(NOMINATION_TIMER_SECONDS);

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
      .filter(p => eligiblePositions.has(p.position))
      .map(p => p.id);

    const resolvedRankings = await fetchPlayerRankings(scoringFormat).catch(() => []);
    const values = computeAuctionValues(players, stats, scoringFormat, resolvedRankings);
    const ranges = computeAuctionRanges(players);
    const rangesForStore: Record<string, { low: number; high: number }> = {};
    for (const [id, r] of Object.entries(ranges)) {
      rangesForStore[id] = { low: r.low, high: r.high };
    }
    startAuction(playerIds, values, rangesForStore, nominationPosition, leagueBudget, leagueSlots, leagueTeamCount);
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
        const bid = getAIBid(team, player, snap.currentBid, snap.playerValues, snap.playerValueRanges);
        if (bid === null) return;

        const delay = isSkippingRef.current
          ? 150 + Math.random() * 250
          : (() => { const [mn, mx] = PERSONALITY_DELAY[team.personality as AIPersonality]; return mn + Math.random() * (mx - mn); })();

        const timeout = setTimeout(() => {
          const fresh = useAuctionStore.getState();
          if (fresh.phase !== 'bidding') return;
          const freshBid = getAIBid(team, player, fresh.currentBid, fresh.playerValues, fresh.playerValueRanges);
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

  // ── Nomination countdown: 30s then auto-pick best available player ────────
  useEffect(() => {
    if (phase !== 'nominating') return;
    setNominationTimeLeft(NOMINATION_TIMER_SECONDS);

    const interval = setInterval(() => {
      setNominationTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          const snap = useAuctionStore.getState();
          const humanTeamSnap = snap.teams.find(t => t.isHuman);
          if (humanTeamSnap && snap.availablePlayerIds.length > 0) {
            const playerId = nominationChoice(humanTeamSnap, snap.availablePlayerIds, players, snap.playerValues);
            if (playerId) snap.humanNominate(playerId);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
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
        if (getAIBid(team, player, snap.currentBid, snap.playerValues, snap.playerValueRanges) === null) return;
        baseDelay += 150 + Math.random() * 200;
        const timeout = setTimeout(() => {
          const fresh = useAuctionStore.getState();
          if (fresh.phase !== 'bidding') return;
          const freshBid = getAIBid(team, player, fresh.currentBid, fresh.playerValues, fresh.playerValueRanges);
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
  const isNominationTurn = phase === 'nominating';

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
            <h2 className="text-2xl font-bold text-white mb-2">
              {leagueTeamCount}-Team Mock Auction
              {activeLeague && activeLeague.name !== 'My League' ? ` · ${activeLeague.name}` : ''}
            </h2>
            <p className="text-slate-400 max-w-md text-sm leading-relaxed">
              ${leagueBudget} budget ·{' '}
              {leagueSlots
                ? (() => {
                    const { QB, RB, WR, TE, FLEX, SFLEX, DEF, K, BN } = leagueSlots;
                    const parts: string[] = [];
                    if (QB) parts.push(`${QB > 1 ? QB : ''}QB`);
                    if (RB) parts.push(`${RB}RB`);
                    if (WR) parts.push(`${WR}WR`);
                    if (TE) parts.push(`${TE > 1 ? TE : ''}TE`);
                    if (FLEX) parts.push(`${FLEX > 1 ? FLEX : ''}FLEX`);
                    if (SFLEX) parts.push(`${SFLEX > 1 ? SFLEX : ''}SF`);
                    if (DEF) parts.push(`${DEF > 1 ? DEF : ''}DEF`);
                    if (K) parts.push(`${K > 1 ? K : ''}K`);
                    if (BN) parts.push(`${BN} bench`);
                    return parts.join(', ');
                  })()
                : 'QB, 2RB, 2WR, TE, FLEX, 7 bench'}.{' '}
              You control one team; {leagueTeamCount - 1} AI managers compete against you.
            </p>
          </div>

          {/* Nomination order picker */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Your Nomination Order</p>
            <div className="flex gap-1.5 flex-wrap justify-center max-w-sm">
              {Array.from({ length: leagueTeamCount }, (_, i) => i + 1).map(pos => (
                <button
                  key={pos}
                  onClick={() => setNominationPosition(pos)}
                  className={`w-9 h-9 rounded-lg text-sm font-semibold border transition-all cursor-pointer ${
                    nominationPosition === pos
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-2.5">
              {nominationPosition === 1
                ? 'You nominate first each round'
                : nominationPosition === leagueTeamCount
                ? 'You nominate last each round'
                : `You are #${nominationPosition} in the nomination order`}
            </p>
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

      {/* Player detail modal */}
      {modalPlayer && (
        <PlayerModal
          player={modalPlayer}
          scoringFormat={scoringFormat}
          scoringSettings={activeLeague?.scoringSettings}
          onClose={() => setModalPlayer(null)}
        />
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
              nominationTimeLeft={nominationTimeLeft}
              onPlaceBid={amount => placeBid(HUMAN_TEAM_ID, amount)}
              onSkip={handleSkip}
              onPlayerClick={setModalPlayer}
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
              onPlayerClick={setModalPlayer}
              isNominationTurn={isNominationTurn}
              onNominate={(playerId, startingBid) => humanNominate(playerId, startingBid)}
            />
          </div>
          <div className="p-5 overflow-hidden flex flex-col">
            <RosterPanel
              teams={teams}
              players={players}
              humanTeamId={HUMAN_TEAM_ID}
              auctionLog={auctionLog}
            />
          </div>
        </div>
      )}
    </div>
  );
}
