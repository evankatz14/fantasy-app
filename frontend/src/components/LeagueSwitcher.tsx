import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ScoringSettingsModal } from './ScoringSettingsModal';
import type { League } from '../types';

export function LeagueSwitcher() {
  const { leagues, activeLeagueId, setActiveLeague } = useAppStore();
  const [editingLeague, setEditingLeague] = useState<League | null>(null);

  if (!leagues.length) return null;

  return (
    <>
      <div className="flex gap-2 items-center">
        <span className="text-xs text-slate-500 uppercase tracking-wider">League:</span>
        {leagues.map((league) => (
          <div key={league.id} className="flex items-center">
            <button
              onClick={() => setActiveLeague(league.id)}
              className={`px-3 py-1.5 rounded-l-lg text-sm font-medium border-y border-l transition-all cursor-pointer ${
                activeLeagueId === league.id
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-indigo-500/50'
              }`}
            >
              {league.name}
            </button>
            <button
              onClick={() => setEditingLeague(league)}
              title="Edit scoring settings"
              className={`px-2 py-1.5 rounded-r-lg text-xs border-y border-r transition-all cursor-pointer ${
                activeLeagueId === league.id
                  ? 'bg-indigo-700 border-indigo-500 text-indigo-200 hover:bg-indigo-600'
                  : 'bg-slate-800 border-slate-600 text-slate-500 hover:text-slate-300 hover:border-indigo-500/50'
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="2.5" />
                <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {editingLeague && (
        <ScoringSettingsModal
          league={editingLeague}
          onClose={() => setEditingLeague(null)}
        />
      )}
    </>
  );
}
