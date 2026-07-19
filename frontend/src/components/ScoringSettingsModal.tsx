import { useEffect, useRef, useState } from 'react';
import type { League, ScoringSettings } from '../types';
import { updateLeagueScoringSettings, fetchLeagues } from '../api';
import { useAppStore } from '../store/useAppStore';

interface Props {
  league: League;
  onClose: () => void;
}

interface FieldDef {
  key: keyof ScoringSettings;
  label: string;
  hint: string;
  step?: number;
}

const FIELDS: { section: string; fields: FieldDef[] }[] = [
  {
    section: 'Passing',
    fields: [
      { key: 'passYdsPer', label: 'Yards per Point', hint: 'e.g. 25 = 1 pt per 25 yds', step: 1 },
      { key: 'passTd',     label: 'TD Points',        hint: 'pts per passing TD' },
      { key: 'passInt',    label: 'INT Points',        hint: 'pts per interception (negative)' },
    ],
  },
  {
    section: 'Rushing',
    fields: [
      { key: 'rushYdsPer', label: 'Yards per Point', hint: 'e.g. 10 = 1 pt per 10 yds', step: 1 },
      { key: 'rushTd',     label: 'TD Points',        hint: 'pts per rushing TD' },
    ],
  },
  {
    section: 'Receiving',
    fields: [
      { key: 'recYdsPer', label: 'Yards per Point', hint: 'e.g. 10 = 1 pt per 10 yds', step: 1 },
      { key: 'recTd',     label: 'TD Points',        hint: 'pts per receiving TD' },
      { key: 'rec',       label: 'Per Reception',    hint: '0 = standard, 0.5 = half PPR, 1 = PPR', step: 0.5 },
    ],
  },
  {
    section: 'Kicking',
    fields: [
      { key: 'fgMade', label: 'FG Made',   hint: 'pts per field goal made' },
      { key: 'xpMade', label: 'XP Made',   hint: 'pts per extra point' },
    ],
  },
  {
    section: 'Misc',
    fields: [
      { key: 'fumbleLost', label: 'Fumble Lost', hint: 'pts per fumble lost (negative)' },
    ],
  },
];

export function ScoringSettingsModal({ league, onClose }: Props) {
  const { setLeagues } = useAppStore();
  const [settings, setSettings] = useState<ScoringSettings>({ ...league.scoringSettings });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function update(key: keyof ScoringSettings, raw: string) {
    const val = parseFloat(raw);
    if (!isNaN(val)) setSettings(prev => ({ ...prev, [key]: val }));
  }

  async function save() {
    setSaving(true);
    setError(false);
    try {
      await updateLeagueScoringSettings(league.id, settings);
      const updated = await fetchLeagues();
      setLeagues(updated);
      onClose();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-12 pb-8 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-700/50">
          <div>
            <h2 className="text-lg font-bold text-white">Scoring Settings</h2>
            <p className="text-xs text-slate-400 mt-0.5">{league.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 transition-colors p-1 cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="4" x2="16" y2="16" /><line x1="16" y1="4" x2="4" y2="16" />
            </svg>
          </button>
        </div>

        {/* Settings form */}
        <div className="px-5 py-4 space-y-5">
          {FIELDS.map(({ section, fields }) => (
            <div key={section}>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{section}</h3>
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
                      value={settings[key]}
                      onChange={(e) => update(key, e.target.value)}
                      className="w-20 shrink-0 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-right text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 pb-5 gap-3">
          {error && <p className="text-xs text-red-400">Failed to save — try again.</p>}
          {!error && <div />}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
