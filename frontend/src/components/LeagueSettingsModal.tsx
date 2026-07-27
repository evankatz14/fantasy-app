import { useEffect, useRef, useState } from 'react';
import type { DraftType, League, RosterSlots, ScoringFormat, ScoringSettings } from '../types';
import { useAppStore } from '../store/useAppStore';

interface Props {
  league: League | null; // null = create mode
  onClose: () => void;
}

const DEFAULT_SCORING: ScoringSettings = {
  passYdsPer: 25, passTd: 4, passInt: -2,
  rushYdsPer: 10, rushTd: 6,
  recYdsPer: 10, recTd: 6, rec: 0.5,
  fgMade: 3, xpMade: 1,
  fumbleLost: -2,
};

const DEFAULT_SLOTS: RosterSlots = {
  QB: 1, RB: 2, WR: 2, TE: 1, K: 0, DEF: 0, FLEX: 1, SFLEX: 0, BN: 7,
};

const TEAM_COUNTS = [2, 4, 6, 8, 10, 12, 14, 16] as const;

const DRAFT_TYPES: { value: DraftType; label: string }[] = [
  { value: 'snake', label: 'Snake' },
  { value: 'auction', label: 'Auction' },
  { value: 'keeper', label: 'Keeper' },
];

const PPR_OPTIONS: { value: 0 | 0.5 | 1; label: string; format: ScoringFormat }[] = [
  { value: 0, label: 'Standard', format: 'standard' },
  { value: 0.5, label: 'Half PPR', format: 'half_ppr' },
  { value: 1, label: 'PPR', format: 'ppr' },
];

const ROSTER_CONFIG: { key: keyof RosterSlots; label: string; max: number }[] = [
  { key: 'QB', label: 'QB', max: 4 },
  { key: 'RB', label: 'RB', max: 6 },
  { key: 'WR', label: 'WR', max: 6 },
  { key: 'TE', label: 'TE', max: 4 },
  { key: 'FLEX', label: 'FLEX', max: 4 },
  { key: 'SFLEX', label: 'Super Flex', max: 2 },
  { key: 'DEF', label: 'DEF', max: 3 },
  { key: 'K', label: 'K', max: 3 },
  { key: 'BN', label: 'Bench', max: 12 },
];

const SCORING_FIELDS: { section: string; fields: { key: keyof ScoringSettings; label: string; hint: string; step?: number }[] }[] = [
  { section: 'Passing', fields: [
    { key: 'passYdsPer', label: 'Yds / Point', hint: '25 = 1 pt per 25 yds', step: 1 },
    { key: 'passTd', label: 'TD Points', hint: 'pts per passing TD' },
    { key: 'passInt', label: 'INT Points', hint: 'negative, e.g. -2' },
  ]},
  { section: 'Rushing', fields: [
    { key: 'rushYdsPer', label: 'Yds / Point', hint: '10 = 1 pt per 10 yds', step: 1 },
    { key: 'rushTd', label: 'TD Points', hint: 'pts per rushing TD' },
  ]},
  { section: 'Receiving', fields: [
    { key: 'recYdsPer', label: 'Yds / Point', hint: '10 = 1 pt per 10 yds', step: 1 },
    { key: 'recTd', label: 'TD Points', hint: 'pts per receiving TD' },
    { key: 'rec', label: 'Per Reception', hint: '0 = standard, 0.5 = half, 1 = PPR', step: 0.5 },
  ]},
  { section: 'Misc', fields: [
    { key: 'fgMade', label: 'FG Made', hint: 'pts per field goal made' },
    { key: 'xpMade', label: 'XP Made', hint: 'pts per extra point' },
    { key: 'fumbleLost', label: 'Fumble Lost', hint: 'negative, e.g. -2' },
  ]},
];

export function LeagueSettingsModal({ league, onClose }: Props) {
  const { leagues, addLeague, updateLeague, deleteLeague, setActiveLeague } = useAppStore();

  const [name, setName] = useState(league?.name ?? 'My League');
  const [teamCount, setTeamCount] = useState(league?.teamCount ?? 12);
  const [draftType, setDraftType] = useState<DraftType>(league?.draftType ?? 'auction');
  const [scoringFormat, setScoringFormat] = useState<ScoringFormat>(league?.scoringFormat ?? 'half_ppr');
  const [slots, setSlots] = useState<RosterSlots>({ ...DEFAULT_SLOTS, ...(league?.rosterSlots ?? {}) });
  const [budget, setBudget] = useState(String(league?.auctionBudget ?? 200));
  const [scoringSettings, setScoringSettings] = useState<ScoringSettings>({ ...DEFAULT_SCORING, ...(league?.scoringSettings ?? {}) });
  const [showAdvanced, setShowAdvanced] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const canDelete = leagues.length > 1 && league !== null;
  const totalSlots = Object.values(slots).reduce((a, b) => a + b, 0);
  const currentPPR = PPR_OPTIONS.find((o) => o.format === scoringFormat);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function setPPR(opt: typeof PPR_OPTIONS[number]) {
    setScoringFormat(opt.format);
    setScoringSettings((s) => ({ ...s, rec: opt.value }));
  }

  function setSlot(key: keyof RosterSlots, delta: number) {
    const cfg = ROSTER_CONFIG.find((r) => r.key === key)!;
    setSlots((s) => ({ ...s, [key]: Math.max(0, Math.min(cfg.max, s[key] + delta)) }));
  }

  function updateScoring(key: keyof ScoringSettings, raw: string) {
    const val = parseFloat(raw);
    if (!isNaN(val)) {
      setScoringSettings((s) => ({ ...s, [key]: val }));
      if (key === 'rec') {
        const fmt = val === 0 ? 'standard' : val === 1 ? 'ppr' : 'half_ppr';
        setScoringFormat(fmt);
      }
    }
  }

  function handleSave() {
    const data: Omit<League, 'id'> = {
      name: name.trim() || 'My League',
      teamCount,
      draftType,
      scoringFormat,
      rosterSlots: slots,
      auctionBudget: draftType === 'auction' ? (parseInt(budget, 10) || 200) : undefined,
      superflex: slots.SFLEX > 0,
      scoringSettings,
    };
    if (league) {
      updateLeague(league.id, data);
    } else {
      const newLeague = addLeague(data);
      setActiveLeague(newLeague.id);
    }
    onClose();
  }

  function handleDelete() {
    if (!league || !canDelete) return;
    deleteLeague(league.id);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-10 pb-8 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-700/50">
          <h2 className="text-lg font-bold text-white">
            {league ? 'League Settings' : 'New League'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors p-1 cursor-pointer">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="4" x2="16" y2="16" /><line x1="16" y1="4" x2="4" y2="16" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-5 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              League Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              placeholder="My League"
            />
          </div>

          {/* Format row */}
          <div className="grid grid-cols-2 gap-5">
            {/* Draft type */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Draft Type
              </label>
              <div className="flex">
                {DRAFT_TYPES.map((dt, i) => (
                  <button
                    key={dt.value}
                    onClick={() => setDraftType(dt.value)}
                    className={`flex-1 py-1.5 text-xs font-semibold border transition-all cursor-pointer
                      ${i === 0 ? 'rounded-l-lg' : i === DRAFT_TYPES.length - 1 ? 'rounded-r-lg' : ''}
                      ${draftType === dt.value
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    {dt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Team count */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Teams
              </label>
              <div className="flex flex-wrap gap-1">
                {TEAM_COUNTS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setTeamCount(n)}
                    className={`w-9 h-8 rounded-lg text-xs font-semibold border transition-all cursor-pointer
                      ${teamCount === n
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                      }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* PPR */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Scoring (PPR)
            </label>
            <div className="flex">
              {PPR_OPTIONS.map((opt, i) => (
                <button
                  key={opt.format}
                  onClick={() => setPPR(opt)}
                  className={`flex-1 py-1.5 text-xs font-semibold border transition-all cursor-pointer
                    ${i === 0 ? 'rounded-l-lg' : i === PPR_OPTIONS.length - 1 ? 'rounded-r-lg' : ''}
                    ${currentPPR?.format === opt.format
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-slate-200'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Roster slots */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Roster
              </label>
              <span className="text-xs text-slate-500">{totalSlots} total spots</span>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {ROSTER_CONFIG.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-slate-300 w-24">{label}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSlot(key, -1)}
                      disabled={slots[key] === 0}
                      className="w-6 h-6 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-bold transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-sm font-semibold text-slate-100 tabular-nums">
                      {slots[key]}
                    </span>
                    <button
                      onClick={() => setSlot(key, 1)}
                      className="w-6 h-6 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-bold transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Auction budget (only for auction type) */}
          {draftType === 'auction' && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Auction Budget (per team)
              </label>
              <div className="relative w-32">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input
                  type="number"
                  min={1}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full pl-6 pr-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Advanced scoring */}
          <div>
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
            >
              <svg
                width="10" height="10" viewBox="0 0 10 10" fill="currentColor"
                className={`transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
              >
                <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
              Advanced scoring settings
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-4">
                {SCORING_FIELDS.map(({ section, fields }) => (
                  <div key={section}>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{section}</h4>
                    <div className="space-y-2">
                      {fields.map(({ key, label, hint, step = 1 }) => (
                        <div key={key} className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-slate-200">{label}</div>
                            <div className="text-xs text-slate-500">{hint}</div>
                          </div>
                          <input
                            type="number"
                            step={step}
                            value={scoringSettings[key]}
                            onChange={(e) => updateScoring(key, e.target.value)}
                            className="w-20 shrink-0 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-right text-slate-100 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 pb-5 pt-1 border-t border-slate-700/50 mt-2">
          <button
            onClick={handleDelete}
            disabled={!canDelete}
            className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 border border-red-400/30 hover:border-red-400/60 rounded-lg transition-colors cursor-pointer disabled:opacity-0 disabled:pointer-events-none"
          >
            Delete League
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors cursor-pointer"
            >
              {league ? 'Save' : 'Create League'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
