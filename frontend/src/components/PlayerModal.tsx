import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchPlayerStats, fetchPlayerWeeklyStats } from '../api';
import type { Player, PlayerSeasonStats, PlayerWeekStats, ScoringFormat, ScoringSettings } from '../types';
import { calcCustomPpg, calcCustomWeekPts } from '../utils/scoring';
import { useAppStore } from '../store/useAppStore';
import { POSITION_COLORS } from './PositionFilter';
import { usePlayerRankings } from '../hooks/usePlayerRankings';
import { computeAuctionValues, matchYahooValues } from '../utils/auctionValues';
import { useYahooPlayerValues } from '../hooks/useYahooPlayerValues';

interface Props {
  player: Player;
  scoringFormat: ScoringFormat;
  scoringSettings?: ScoringSettings;
  onClose: () => void;
}

function fmt(val: number | null | undefined, decimals = 0): string {
  if (val == null) return '—';
  return decimals > 0 ? val.toFixed(decimals) : String(val);
}

function fmtPct(val: number | null | undefined): string {
  if (val == null) return '—';
  return `${val}%`;
}

// ── Sparkline ──────────────────────────────────────────────────────────────

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const W = 100, H = 40;
  const max = Math.max(...values, 1);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const avgY = H - (avg / max) * H;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - (v / max) * H;
    return { x, y };
  });
  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 48 }} preserveAspectRatio="none">
      <line x1={0} y1={avgY} x2={W} y2={avgY} stroke="#334155" strokeWidth="0.8" strokeDasharray="2,2" />
      <polyline points={polyline} fill="none" stroke="#818cf8" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="1.8" fill="#818cf8" />
      ))}
    </svg>
  );
}

// ── Season stat table rows ─────────────────────────────────────────────────

function QBRow({ s }: { s: PlayerSeasonStats }) {
  return (
    <tr className="border-t border-slate-700/50 hover:bg-slate-700/20">
      <td className="py-2 px-3 font-semibold text-slate-200">{s.season}</td>
      <td className="py-2 px-3 text-slate-300">{s.gamesPlayed}</td>
      <td className="py-2 px-3 text-slate-300">{fmt(s.passCmp)}/{fmt(s.passAtt)}</td>
      <td className="py-2 px-3 text-slate-300">{fmtPct(s.passCmpPct)}</td>
      <td className="py-2 px-3 text-slate-300">{fmt(s.passYds)}</td>
      <td className="py-2 px-3 text-slate-300">{fmt(s.passYdsPg, 1)}</td>
      <td className="py-2 px-3 text-slate-300">{fmt(s.passTds)}</td>
      <td className="py-2 px-3 text-slate-300">{fmt(s.passInts)}</td>
      <td className="py-2 px-3 text-slate-300">{fmt(s.rushYds)}</td>
      <td className="py-2 px-3 text-slate-300">{fmt(s.rushTds)}</td>
    </tr>
  );
}

function RBRow({ s }: { s: PlayerSeasonStats }) {
  const totalTds = (s.rushTds ?? 0) + (s.recTds ?? 0);
  return (
    <tr className="border-t border-slate-700/50 hover:bg-slate-700/20">
      <td className="py-2 px-3 font-semibold text-slate-200">{s.season}</td>
      <td className="py-2 px-3 text-slate-300">{s.gamesPlayed}</td>
      <td className="py-2 px-3 text-slate-300">{fmt(s.rushAtt)}</td>
      <td className="py-2 px-3 text-slate-300">{fmt(s.rushYds)}</td>
      <td className="py-2 px-3 text-slate-300">{fmt(s.rushYdsPg, 1)}</td>
      <td className="py-2 px-3 text-slate-300">{fmt(s.rushYpc, 1)}</td>
      <td className="py-2 px-3 text-slate-300">{fmt(s.recTgts)}</td>
      <td className="py-2 px-3 text-slate-300">{fmt(s.rec)}</td>
      <td className="py-2 px-3 text-slate-300">{fmt(s.recYds)}</td>
      <td className="py-2 px-3 text-slate-300">{totalTds || '—'}</td>
    </tr>
  );
}

function WRTERow({ s }: { s: PlayerSeasonStats }) {
  return (
    <tr className="border-t border-slate-700/50 hover:bg-slate-700/20">
      <td className="py-2 px-3 font-semibold text-slate-200">{s.season}</td>
      <td className="py-2 px-3 text-slate-300">{s.gamesPlayed}</td>
      <td className="py-2 px-3 text-slate-300">{fmt(s.recTgts)}</td>
      <td className="py-2 px-3 text-slate-300">{fmt(s.rec)}</td>
      <td className="py-2 px-3 text-slate-300">{fmt(s.recYds)}</td>
      <td className="py-2 px-3 text-slate-300">{fmt(s.recYdsPg, 1)}</td>
      <td className="py-2 px-3 text-slate-300">{fmt(s.recYpr, 1)}</td>
      <td className="py-2 px-3 text-slate-300">{fmt(s.recTds)}</td>
    </tr>
  );
}

function KRow({ s }: { s: PlayerSeasonStats }) {
  return (
    <tr className="border-t border-slate-700/50 hover:bg-slate-700/20">
      <td className="py-2 px-3 font-semibold text-slate-200">{s.season}</td>
      <td className="py-2 px-3 text-slate-300">{s.gamesPlayed}</td>
      <td className="py-2 px-3 text-slate-300">{fmt(s.fgm)}/{fmt(s.fga)}</td>
      <td className="py-2 px-3 text-slate-300">{fmtPct(s.fgPct)}</td>
      <td className="py-2 px-3 text-slate-300">{fmt(s.xpm)}</td>
    </tr>
  );
}

function StatsTable({ position, seasons }: { position: string; seasons: PlayerSeasonStats[] }) {
  if (!seasons.length) return <p className="text-slate-500 text-sm py-4">No historical stats available.</p>;

  const thClass = 'py-2 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap';

  if (position === 'QB') return (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-slate-700">
        <th className={thClass}>Season</th><th className={thClass}>GP</th>
        <th className={thClass}>CMP/ATT</th><th className={thClass}>CMP%</th>
        <th className={thClass}>YDS</th><th className={thClass}>Y/G</th>
        <th className={thClass}>TD</th><th className={thClass}>INT</th>
        <th className={thClass}>RUSH YDS</th><th className={thClass}>RUSH TD</th>
      </tr></thead>
      <tbody>{seasons.map(s => <QBRow key={s.season} s={s} />)}</tbody>
    </table>
  );

  if (position === 'RB') return (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-slate-700">
        <th className={thClass}>Season</th><th className={thClass}>GP</th>
        <th className={thClass}>CAR</th><th className={thClass}>YDS</th>
        <th className={thClass}>Y/G</th><th className={thClass}>YPC</th>
        <th className={thClass}>TGT</th><th className={thClass}>REC</th>
        <th className={thClass}>REC YDS</th><th className={thClass}>TD</th>
      </tr></thead>
      <tbody>{seasons.map(s => <RBRow key={s.season} s={s} />)}</tbody>
    </table>
  );

  if (position === 'WR' || position === 'TE') return (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-slate-700">
        <th className={thClass}>Season</th><th className={thClass}>GP</th>
        <th className={thClass}>TGT</th><th className={thClass}>REC</th>
        <th className={thClass}>YDS</th><th className={thClass}>Y/G</th>
        <th className={thClass}>YPR</th><th className={thClass}>TD</th>
      </tr></thead>
      <tbody>{seasons.map(s => <WRTERow key={s.season} s={s} />)}</tbody>
    </table>
  );

  if (position === 'K') return (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-slate-700">
        <th className={thClass}>Season</th><th className={thClass}>GP</th>
        <th className={thClass}>FGM/FGA</th><th className={thClass}>FG%</th>
        <th className={thClass}>XPM</th>
      </tr></thead>
      <tbody>{seasons.map(s => <KRow key={s.season} s={s} />)}</tbody>
    </table>
  );

  return (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-slate-700">
        <th className={thClass}>Season</th><th className={thClass}>GP</th>
        <th className={thClass}>PPR PPG</th><th className={thClass}>Half PPG</th><th className={thClass}>Std PPG</th>
      </tr></thead>
      <tbody>{seasons.map(s => (
        <tr key={s.season} className="border-t border-slate-700/50 hover:bg-slate-700/20">
          <td className="py-2 px-3 font-semibold text-slate-200">{s.season}</td>
          <td className="py-2 px-3 text-slate-300">{s.gamesPlayed}</td>
          <td className="py-2 px-3 text-slate-300">{fmt(s.ptsPerGame.ppr, 1)}</td>
          <td className="py-2 px-3 text-slate-300">{fmt(s.ptsPerGame.half_ppr, 1)}</td>
          <td className="py-2 px-3 text-slate-300">{fmt(s.ptsPerGame.standard, 1)}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}

// ── Per-game weekly table ──────────────────────────────────────────────────

function WeeklyQBRow({ w, customPts }: { w: PlayerWeekStats; customPts: number }) {
  return (
    <tr className="border-t border-slate-700/50 hover:bg-slate-700/20">
      <td className="py-1.5 px-3 font-mono text-slate-400 text-xs">Wk{w.week}</td>
      <td className="py-1.5 px-3 text-slate-300">{w.passCmp != null ? `${w.passCmp}/${w.passAtt ?? '?'}` : '—'}</td>
      <td className="py-1.5 px-3 text-slate-300">{fmt(w.passYds)}</td>
      <td className="py-1.5 px-3 text-slate-300">{fmt(w.passTds)}</td>
      <td className="py-1.5 px-3 text-slate-300">{fmt(w.passInts)}</td>
      <td className="py-1.5 px-3 text-slate-300">{fmt(w.rushYds)}</td>
      <td className="py-1.5 px-3 font-semibold text-indigo-300">{customPts.toFixed(1)}</td>
    </tr>
  );
}

function WeeklyRBRow({ w, customPts }: { w: PlayerWeekStats; customPts: number }) {
  const totalTds = (w.rushTds ?? 0) + (w.recTds ?? 0);
  return (
    <tr className="border-t border-slate-700/50 hover:bg-slate-700/20">
      <td className="py-1.5 px-3 font-mono text-slate-400 text-xs">Wk{w.week}</td>
      <td className="py-1.5 px-3 text-slate-300">{fmt(w.rushAtt)}</td>
      <td className="py-1.5 px-3 text-slate-300">{fmt(w.rushYds)}</td>
      <td className="py-1.5 px-3 text-slate-300">{fmt(w.rec)}</td>
      <td className="py-1.5 px-3 text-slate-300">{fmt(w.recYds)}</td>
      <td className="py-1.5 px-3 text-slate-300">{totalTds || '—'}</td>
      <td className="py-1.5 px-3 font-semibold text-indigo-300">{customPts.toFixed(1)}</td>
    </tr>
  );
}

function WeeklyWRTERow({ w, customPts }: { w: PlayerWeekStats; customPts: number }) {
  return (
    <tr className="border-t border-slate-700/50 hover:bg-slate-700/20">
      <td className="py-1.5 px-3 font-mono text-slate-400 text-xs">Wk{w.week}</td>
      <td className="py-1.5 px-3 text-slate-300">{fmt(w.recTgts)}</td>
      <td className="py-1.5 px-3 text-slate-300">{fmt(w.rec)}</td>
      <td className="py-1.5 px-3 text-slate-300">{fmt(w.recYds)}</td>
      <td className="py-1.5 px-3 text-slate-300">{fmt(w.recTds)}</td>
      <td className="py-1.5 px-3 font-semibold text-indigo-300">{customPts.toFixed(1)}</td>
    </tr>
  );
}

function WeeklyKRow({ w, customPts }: { w: PlayerWeekStats; customPts: number }) {
  return (
    <tr className="border-t border-slate-700/50 hover:bg-slate-700/20">
      <td className="py-1.5 px-3 font-mono text-slate-400 text-xs">Wk{w.week}</td>
      <td className="py-1.5 px-3 text-slate-300">{w.fgm != null ? `${w.fgm}/${w.fga ?? '?'}` : '—'}</td>
      <td className="py-1.5 px-3 text-slate-300">{fmt(w.xpm)}</td>
      <td className="py-1.5 px-3 font-semibold text-indigo-300">{customPts.toFixed(1)}</td>
    </tr>
  );
}

function WeeklyTable({
  position, weeks, scoringSettings,
}: {
  position: string;
  weeks: PlayerWeekStats[];
  scoringSettings: ScoringSettings;
}) {
  const thClass = 'py-2 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap';

  if (position === 'QB') return (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-slate-700">
        <th className={thClass}>Wk</th><th className={thClass}>CMP/ATT</th>
        <th className={thClass}>PASS YDS</th><th className={thClass}>TD</th>
        <th className={thClass}>INT</th><th className={thClass}>RUSH YDS</th>
        <th className={`${thClass} text-indigo-400`}>PTS</th>
      </tr></thead>
      <tbody>{weeks.map(w => <WeeklyQBRow key={w.week} w={w} customPts={calcCustomWeekPts(w, scoringSettings)} />)}</tbody>
    </table>
  );

  if (position === 'RB') return (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-slate-700">
        <th className={thClass}>Wk</th><th className={thClass}>CAR</th>
        <th className={thClass}>RUSH YDS</th><th className={thClass}>REC</th>
        <th className={thClass}>REC YDS</th><th className={thClass}>TD</th>
        <th className={`${thClass} text-indigo-400`}>PTS</th>
      </tr></thead>
      <tbody>{weeks.map(w => <WeeklyRBRow key={w.week} w={w} customPts={calcCustomWeekPts(w, scoringSettings)} />)}</tbody>
    </table>
  );

  if (position === 'WR' || position === 'TE') return (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-slate-700">
        <th className={thClass}>Wk</th><th className={thClass}>TGT</th>
        <th className={thClass}>REC</th><th className={thClass}>REC YDS</th>
        <th className={thClass}>TD</th>
        <th className={`${thClass} text-indigo-400`}>PTS</th>
      </tr></thead>
      <tbody>{weeks.map(w => <WeeklyWRTERow key={w.week} w={w} customPts={calcCustomWeekPts(w, scoringSettings)} />)}</tbody>
    </table>
  );

  if (position === 'K') return (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-slate-700">
        <th className={thClass}>Wk</th><th className={thClass}>FGM/FGA</th>
        <th className={thClass}>XPM</th>
        <th className={`${thClass} text-indigo-400`}>PTS</th>
      </tr></thead>
      <tbody>{weeks.map(w => <WeeklyKRow key={w.week} w={w} customPts={calcCustomWeekPts(w, scoringSettings)} />)}</tbody>
    </table>
  );

  return null;
}

// ── Spinner ────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center gap-2 text-slate-400 py-6">
      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      <span className="text-sm">Loading…</span>
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────

const SCORING_LABELS: Record<ScoringFormat, string> = {
  ppr: 'PPR',
  half_ppr: 'Half PPR',
  standard: 'Standard',
};

// ── Auction price editor ───────────────────────────────────────────────────

function AuctionSection({ playerId, leagueId, leagueName, budget, auctionValue, yahooAav }: {
  playerId: string;
  leagueId: string;
  leagueName: string;
  budget?: number;
  auctionValue?: number | null;
  yahooAav?: number | null;
}) {
  const { auctionPrices, setAuctionPrice } = useAppStore();
  const saved = auctionPrices[leagueId]?.[playerId];
  const [min, setMin] = useState(saved?.min?.toString() ?? '');
  const [max, setMax] = useState(saved?.max?.toString() ?? '');

  function save() {
    const parsedMin = min !== '' ? Number(min) : null;
    const parsedMax = max !== '' ? Number(max) : null;
    setAuctionPrice(leagueId, playerId, parsedMin, parsedMax);
  }

  function clear() {
    setMin('');
    setMax('');
    setAuctionPrice(leagueId, playerId, null, null);
  }

  const hasSaved = saved?.min != null || saved?.max != null;

  return (
    <div className="flex flex-col gap-3">
      {(yahooAav != null || auctionValue != null) && (
        <div className="flex items-center gap-4">
          {yahooAav != null && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">Yahoo avg</span>
              <span className="text-sm font-semibold text-purple-400">${yahooAav.toFixed(1)}</span>
            </div>
          )}
          {auctionValue != null && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">{yahooAav != null ? 'Adj. value' : 'Est. value'}</span>
              <span className="text-sm font-semibold text-indigo-400">${auctionValue}</span>
            </div>
          )}
        </div>
      )}
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400">Min</label>
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
          <input
            type="number"
            min={0}
            max={budget}
            value={min}
            onChange={e => setMin(e.target.value)}
            onBlur={save}
            placeholder="—"
            className="w-20 pl-5 pr-2 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-emerald-500 placeholder-slate-600"
          />
        </div>
      </div>
      <span className="text-slate-600">—</span>
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400">Max</label>
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
          <input
            type="number"
            min={0}
            max={budget}
            value={max}
            onChange={e => setMax(e.target.value)}
            onBlur={save}
            placeholder="—"
            className="w-20 pl-5 pr-2 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-emerald-500 placeholder-slate-600"
          />
        </div>
      </div>
      {hasSaved && (
        <button
          onClick={clear}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
        >
          clear
        </button>
      )}
      {budget && (
        <span className="text-xs text-slate-600 ml-auto">${budget} budget</span>
      )}
    </div>
    </div>
  );
}

export function PlayerModal({ player, scoringFormat, scoringSettings, onClose }: Props) {
  const { activeLeagueId, leagues, players: allPlayers, stats: allStats } = useAppStore();
  const activeLeague = leagues.find(l => l.id === activeLeagueId);
  const rankings = usePlayerRankings(scoringFormat);
  const { values: yahooRaw, authenticated: yahooAuthed } = useYahooPlayerValues();

  const yahooMatched = useMemo(
    () => matchYahooValues(yahooRaw, allPlayers),
    [yahooRaw, allPlayers],
  );

  const auctionValues = useMemo(
    () => computeAuctionValues(allPlayers, allStats, scoringFormat, rankings, yahooMatched),
    [allPlayers, allStats, scoringFormat, rankings, yahooMatched],
  );
  const auctionValue = auctionValues[player.id] ?? null;
  // Show raw Yahoo AAV when available (before normalization)
  const yahooAav = yahooMatched[player.id] ?? null;

  const [seasons, setSeasons] = useState<PlayerSeasonStats[] | null>(null);
  const [seasonError, setSeasonError] = useState(false);

  const [activeTab, setActiveTab] = useState<'season' | 'perGame'>('season');
  const [perGameSeason, setPerGameSeason] = useState(2025);
  const [weeks, setWeeks] = useState<PlayerWeekStats[] | null>(null);
  const [weekError, setWeekError] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPlayerStats(player.id)
      .then(setSeasons)
      .catch(() => setSeasonError(true));
  }, [player.id]);

  useEffect(() => {
    if (activeTab !== 'perGame') return;
    setWeeks(null);
    setWeekError(false);
    fetchPlayerWeeklyStats(player.id, perGameSeason)
      .then(setWeeks)
      .catch(() => setWeekError(true));
  }, [player.id, activeTab, perGameSeason]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const posColor = POSITION_COLORS[player.position] ?? POSITION_COLORS['ALL'];
  const mostRecent = seasons?.[0];

  const customPpg = mostRecent && scoringSettings ? calcCustomPpg(mostRecent, scoringSettings) : null;

  const weeklyCustomPts = weeks && scoringSettings
    ? weeks.map(w => calcCustomWeekPts(w, scoringSettings))
    : null;

  const availableSeasons = seasons?.map(s => s.season) ?? [2025];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-16 pb-8 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <span className={`text-sm font-bold px-2 py-1 rounded border ${posColor}`}>
              {player.position}
            </span>
            <div>
              <h2 className="text-xl font-bold text-white">{player.fullName}</h2>
              <p className="text-sm text-slate-400 mt-0.5">
                {[player.team, player.age ? `Age ${player.age}` : null, player.yearsExp != null ? `${player.yearsExp} yr exp` : null]
                  .filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 transition-colors p-1 cursor-pointer"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="4" x2="16" y2="16" /><line x1="16" y1="4" x2="4" y2="16" />
            </svg>
          </button>
        </div>

        {/* Fantasy PPG cards */}
        {mostRecent && (
          <div className="px-6 py-4 border-b border-slate-700/50">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">{mostRecent.season} Fantasy Points per Game</p>

            {/* Custom scoring prominently if available */}
            {customPpg != null && (
              <div className="mb-3 flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-600/20 border border-indigo-500/40">
                <div>
                  <div className="text-3xl font-bold text-indigo-300">{customPpg}</div>
                  <div className="text-xs text-indigo-400/80 mt-0.5">Your League PPG</div>
                </div>
                <div className="flex-1" />
                <div className="text-right text-xs text-slate-500 leading-relaxed">
                  <div>{mostRecent.gamesPlayed} games played</div>
                  <div className="text-indigo-500/70">custom scoring</div>
                </div>
              </div>
            )}

            {/* Sleeper reference values */}
            <div className="grid grid-cols-3 gap-2">
              {(['ppr', 'half_ppr', 'standard'] as ScoringFormat[]).map((f) => (
                <div
                  key={f}
                  className={`rounded-lg px-3 py-2 border text-center ${
                    f === scoringFormat && !scoringSettings
                      ? 'bg-indigo-600/20 border-indigo-500/50'
                      : 'bg-slate-800/60 border-slate-700/50'
                  }`}
                >
                  <div className={`text-xl font-bold ${f === scoringFormat && !scoringSettings ? 'text-indigo-300' : 'text-slate-200'}`}>
                    {mostRecent.ptsPerGame[f]}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{SCORING_LABELS[f]}</div>
                </div>
              ))}
            </div>
            {!customPpg && (
              <p className="text-xs text-slate-600 mt-2">{mostRecent.gamesPlayed} games played</p>
            )}
          </div>
        )}

        {/* Auction price editor — shown only when there's an active league */}
        {activeLeagueId && activeLeague && (
          <div className="px-6 py-4 border-b border-slate-700/50">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">
              Auction Price Range
              <span className="ml-2 text-slate-600 normal-case tracking-normal">{activeLeague.name}</span>
            </p>
            <AuctionSection
              playerId={player.id}
              leagueId={activeLeagueId}
              leagueName={activeLeague.name}
              budget={activeLeague.auctionBudget}
              auctionValue={auctionValue}
              yahooAav={yahooAav}
            />
          </div>
        )}

        {/* Tab selector */}
        <div className="flex gap-1 px-6 pt-4 pb-2">
          <button
            onClick={() => setActiveTab('season')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === 'season'
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Season Stats
          </button>
          <button
            onClick={() => setActiveTab('perGame')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === 'perGame'
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Per Game
          </button>
        </div>

        {/* Season Stats tab */}
        {activeTab === 'season' && (
          <>
            <div className="px-6 pb-4">
              {seasonError ? (
                <p className="text-red-400 text-sm py-4">Failed to load stats.</p>
              ) : seasons === null ? (
                <Spinner />
              ) : (
                <div className="overflow-x-auto">
                  <StatsTable position={player.position} seasons={seasons} />
                </div>
              )}
            </div>

            {/* Fantasy PPG by season */}
            {seasons && seasons.length > 0 && (
              <div className="px-6 pb-5 border-t border-slate-700/50 pt-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Fantasy PPG by Season</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      {['Season', 'GP', scoringSettings ? 'Custom' : null, 'PPR', 'Half PPR', 'Std'].filter(Boolean).map(h => (
                        <th key={h} className="py-2 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {seasons.map(s => (
                      <tr key={s.season} className="border-t border-slate-700/50 hover:bg-slate-700/20">
                        <td className="py-2 px-3 font-semibold text-slate-200">{s.season}</td>
                        <td className="py-2 px-3 text-slate-300">{s.gamesPlayed}</td>
                        {scoringSettings && (
                          <td className="py-2 px-3 font-bold text-indigo-300">
                            {calcCustomPpg(s, scoringSettings).toFixed(1)}
                          </td>
                        )}
                        <td className="py-2 px-3 text-slate-300">{fmt(s.ptsPerGame.ppr, 1)}</td>
                        <td className={`py-2 px-3 font-medium ${!scoringSettings && scoringFormat === 'half_ppr' ? 'text-indigo-300' : 'text-slate-300'}`}>{fmt(s.ptsPerGame.half_ppr, 1)}</td>
                        <td className="py-2 px-3 text-slate-300">{fmt(s.ptsPerGame.standard, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Per Game tab */}
        {activeTab === 'perGame' && (
          <div className="px-6 pb-5">
            {/* Season selector */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-slate-500">Season:</span>
              <div className="flex gap-1">
                {availableSeasons.map(yr => (
                  <button
                    key={yr}
                    onClick={() => setPerGameSeason(yr)}
                    className={`px-2 py-1 text-xs font-mono rounded border cursor-pointer transition-colors ${
                      perGameSeason === yr
                        ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300'
                        : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            </div>

            {weekError ? (
              <p className="text-red-400 text-sm py-4">Failed to load weekly stats.</p>
            ) : weeks === null ? (
              <Spinner />
            ) : weeks.length === 0 ? (
              <p className="text-slate-500 text-sm py-4">No game data available for {perGameSeason}.</p>
            ) : (
              <>
                {/* Sparkline */}
                {weeklyCustomPts && weeklyCustomPts.length >= 2 && (
                  <div className="mb-4 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-500">
                        {scoringSettings ? 'Custom pts per game' : 'Half PPR pts per game'}
                      </span>
                      <span className="text-xs text-slate-500">
                        Avg: {(weeklyCustomPts.reduce((a, b) => a + b, 0) / weeklyCustomPts.length).toFixed(1)} / game
                      </span>
                    </div>
                    <Sparkline values={weeklyCustomPts} />
                    <div className="flex justify-between text-xs text-slate-600 mt-1">
                      <span>Wk {weeks[0].week}</span>
                      <span>Wk {weeks[weeks.length - 1].week}</span>
                    </div>
                  </div>
                )}

                {/* Weekly table */}
                {scoringSettings ? (
                  <div className="overflow-x-auto">
                    <WeeklyTable position={player.position} weeks={weeks} scoringSettings={scoringSettings} />
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">No scoring settings available.</p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
