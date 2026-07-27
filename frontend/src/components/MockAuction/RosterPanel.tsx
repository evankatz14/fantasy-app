import { useState } from 'react';
import type { Player } from '../../types';
import type { AuctionTeam, AuctionLogEntry } from '../../store/useAuctionStore';
import { maxBid } from '../../utils/auctionAI';
import { POSITION_COLORS } from '../PositionFilter';

interface Props {
  teams: AuctionTeam[];
  players: Player[];
  humanTeamId: string;
  auctionLog: AuctionLogEntry[];
}

const SLOT_LABEL_COLOR: Record<string, string> = {
  QB: 'text-red-400',
  RB: 'text-green-400',
  WR: 'text-blue-400',
  TE: 'text-orange-400',
  FLEX: 'text-purple-400',
  DEF: 'text-yellow-400',
  BN: 'text-slate-500',
};

export function RosterPanel({ teams, players, humanTeamId, auctionLog }: Props) {
  const [selectedTeamId, setSelectedTeamId] = useState(humanTeamId);
  const [tab, setTab] = useState<'roster' | 'log' | 'budgets'>('roster');

  const playerMap = new Map(players.map(p => [p.id, p]));
  const teamMap = new Map(teams.map(t => [t.id, t]));
  const selectedTeam = teamMap.get(selectedTeamId) ?? teams[0];

  const filledSlots = selectedTeam.roster.filter(s => s.playerId !== null).length;
  const totalSlots = selectedTeam.roster.length;

  return (
    <div className="flex flex-col h-full">
      {/* Team selector */}
      <div className="flex-none mb-3">
        <select
          value={selectedTeamId}
          onChange={e => setSelectedTeamId(e.target.value)}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
        >
          {teams.map(t => (
            <option key={t.id} value={t.id}>
              {t.isHuman ? '⭐ ' : ''}{t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Budget + roster progress */}
      <div className="flex-none flex items-center justify-between text-xs text-slate-500 mb-3 pb-3 border-b border-slate-700/50">
        <span>
          Budget: <span className="text-emerald-400 font-semibold">${selectedTeam.budget}</span> left
        </span>
        <span>{filledSlots}/{totalSlots} filled</span>
        {!selectedTeam.isHuman && (
          <span className="text-slate-600 capitalize">{selectedTeam.personality}</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex-none flex gap-1 mb-3">
        {(['roster', 'log', 'budgets'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              tab === t ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t === 'roster' ? 'Roster' : t === 'log' ? 'Log' : 'Budgets'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'budgets' ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-600 px-1 pb-1 mb-1 border-b border-slate-700/40">
              <span>Team</span>
              <div className="flex gap-4">
                <span className="w-12 text-right">Budget</span>
                <span className="w-12 text-right">Max bid</span>
              </div>
            </div>
            {[...teams]
              .sort((a, b) => b.budget - a.budget)
              .map(team => {
                const mb = maxBid(team);
                const isHuman = team.id === humanTeamId;
                return (
                  <div
                    key={team.id}
                    className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-xs ${
                      isHuman ? 'bg-emerald-900/20 border border-emerald-700/30' : 'bg-slate-800/40 border border-slate-700/20'
                    }`}
                  >
                    <div className="flex items-center flex-1 min-w-0">
                      <span className={`truncate ${isHuman ? 'text-emerald-300 font-semibold' : 'text-slate-300'}`}>
                        {isHuman ? '⭐ ' : ''}{team.name}
                      </span>
                    </div>
                    <div className="flex gap-4 shrink-0">
                      <span className={`w-12 text-right font-semibold ${team.budget < 20 ? 'text-red-400' : 'text-emerald-400'}`}>
                        ${team.budget}
                      </span>
                      <span className="w-12 text-right text-slate-400">${mb}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        ) : tab === 'roster' ? (
          <div className="space-y-1">
            {selectedTeam.roster.map((slot, i) => {
              const player = slot.playerId ? playerMap.get(slot.playerId) : null;
              const posColor = player
                ? (POSITION_COLORS[player.position] ?? POSITION_COLORS['ALL'])
                : '';
              const labelColor = SLOT_LABEL_COLOR[slot.label] ?? 'text-slate-500';

              return (
                <div
                  key={`${slot.key}-${i}`}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                    player
                      ? 'bg-slate-800/60 border-slate-700/40'
                      : 'bg-slate-800/20 border-slate-700/20'
                  }`}
                >
                  <span className={`w-10 text-xs font-bold shrink-0 ${labelColor}`}>
                    {slot.label}
                  </span>
                  {player ? (
                    <>
                      <span className={`text-xs font-bold px-1 py-0.5 rounded border shrink-0 ${posColor}`}>
                        {player.position}
                      </span>
                      <span className="flex-1 text-slate-200 truncate">{player.fullName}</span>
                      {slot.price != null && (
                        <span className="text-emerald-400 font-semibold text-xs shrink-0">
                          ${slot.price}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-600 italic text-xs">empty</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1">
            {auctionLog.length === 0 && (
              <div className="text-slate-600 text-sm text-center pt-8">No picks yet</div>
            )}
            {[...auctionLog].reverse().map((entry, i) => {
              const player = playerMap.get(entry.playerId);
              const winner = teamMap.get(entry.winnerTeamId);
              if (!player) return null;
              const posColor = POSITION_COLORS[player.position] ?? POSITION_COLORS['ALL'];
              const isHuman = entry.winnerTeamId === humanTeamId;

              return (
                <div
                  key={i}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                    isHuman
                      ? 'bg-emerald-900/20 border-emerald-700/30'
                      : 'bg-slate-800/40 border-slate-700/30'
                  }`}
                >
                  <span className={`text-xs font-bold px-1 py-0.5 rounded border shrink-0 ${posColor}`}>
                    {player.position}
                  </span>
                  <span className="flex-1 text-slate-200 truncate">{player.fullName}</span>
                  <div className="text-right shrink-0">
                    <div className="text-emerald-400 font-semibold text-xs">${entry.price}</div>
                    <div className={`text-xs ${isHuman ? 'text-emerald-600' : 'text-slate-600'}`}>
                      {winner?.name ?? '—'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

