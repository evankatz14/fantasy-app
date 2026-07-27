import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { fetchPlayers, fetchLeagues, fetchStats } from '../api';
import { RankingBoard } from './RankingBoard';
import { PositionFilter } from './PositionFilter';
import { LeagueSwitcher } from './LeagueSwitcher';

interface Props {
  onMockAuction: () => void;
}

export function PlayerList({ onMockAuction }: Props) {
  const {
    players,
    leagues,
    activeLeagueId,
    showStats,
    showTiers,
    setPlayers,
    setLeagues,
    setActiveLeague,
    setStats,
    toggleShowStats,
    toggleShowTiers,
    addTierAtEnd,
    initOrderedItems,
  } = useAppStore();

  useEffect(() => {
    if (leagues.length > 0) {
      // Leagues already persisted locally — just ensure an active league is set
      if (!activeLeagueId) setActiveLeague(leagues[0].id);
    } else {
      // First run (or post-migration): seed from backend defaults
      fetchLeagues().then((data) => {
        setLeagues(data);
        if (!activeLeagueId && data.length) setActiveLeague(data[0].id);
      });
    }
  }, []);

  useEffect(() => {
    if (!players.length) fetchPlayers().then(setPlayers);
  }, []);

  useEffect(() => {
    if (activeLeagueId && players.length) initOrderedItems(activeLeagueId, players);
  }, [activeLeagueId, players.length]);

  // Fetch stats in background — doesn't block the board from showing
  useEffect(() => {
    fetchStats(2025).then(setStats).catch(() => {});
  }, []);

  const isLoading = !leagues.length || !players.length;

  return (
    <div className="h-screen flex flex-col bg-slate-900 overflow-hidden">
      {/* Fixed header */}
      <div className="flex-none px-6 pt-5 pb-4 border-b border-slate-700/40">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-baseline justify-between mb-3">
            <h1 className="text-2xl font-bold text-white">Fantasy Rankings</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={onMockAuction}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer bg-emerald-600/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-600/30"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="6" cy="6" r="5" />
                  <line x1="6" y1="3" x2="6" y2="6" />
                  <line x1="6" y1="6" x2="8.5" y2="8.5" />
                </svg>
                Mock Auction
              </button>
              <span className="text-slate-500 text-sm">
                {players.length ? `${players.length} players` : 'Loading...'}
              </span>
              {/* Tiers toggle */}
              <button
                onClick={toggleShowTiers}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                  showTiers
                    ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                    : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="0" y1="6" x2="12" y2="6" />
                  <line x1="3" y1="2" x2="9" y2="2" strokeDasharray="1.5 1.5" />
                  <line x1="3" y1="10" x2="9" y2="10" strokeDasharray="1.5 1.5" />
                </svg>
                Tiers {showTiers ? 'on' : 'off'}
              </button>

              {/* Add tier button */}
              <button
                onClick={() => activeLeagueId && showTiers && addTierAtEnd(activeLeagueId)}
                disabled={!activeLeagueId || !showTiers}
                title={!showTiers ? 'Enable tiers first' : 'Add a tier break at the bottom'}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-200 disabled:opacity-30 disabled:cursor-default"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="6" y1="1" x2="6" y2="11" />
                  <line x1="1" y1="6" x2="11" y2="6" />
                </svg>
                Add Tier
              </button>

              {/* Stats toggle */}
              <button
                onClick={toggleShowStats}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                  showStats
                    ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                    : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="1" y="7" width="2" height="4" rx="0.5" />
                  <rect x="5" y="4" width="2" height="7" rx="0.5" />
                  <rect x="9" y="1" width="2" height="10" rx="0.5" />
                </svg>
                Stats {showStats ? 'on' : 'off'}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <LeagueSwitcher />
            <PositionFilter />
          </div>
        </div>
      </div>

      {/* Scrollable board */}
      <div className="flex-1 overflow-hidden px-6 py-3">
        <div className="max-w-3xl mx-auto h-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-slate-400">
              <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading players from Sleeper...
            </div>
          ) : (
            <RankingBoard />
          )}
        </div>
      </div>
    </div>
  );
}
