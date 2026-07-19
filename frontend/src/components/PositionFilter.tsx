import type { FantasyPosition } from '../types';
import { useAppStore } from '../store/useAppStore';

const POSITIONS: Array<FantasyPosition | 'ALL'> = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

const POSITION_COLORS: Record<string, string> = {
  QB: 'bg-red-500/20 text-red-300 border-red-500/40',
  RB: 'bg-green-500/20 text-green-300 border-green-500/40',
  WR: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  TE: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  K:  'bg-purple-500/20 text-purple-300 border-purple-500/40',
  DEF: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  ALL: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
};

export function PositionFilter() {
  const { positionFilter, setPositionFilter } = useAppStore();

  return (
    <div className="flex gap-2 flex-wrap">
      {POSITIONS.map((pos) => (
        <button
          key={pos}
          onClick={() => setPositionFilter(pos)}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all cursor-pointer ${
            POSITION_COLORS[pos]
          } ${
            positionFilter === pos
              ? 'opacity-100 ring-2 ring-white/20'
              : 'opacity-50 hover:opacity-80'
          }`}
        >
          {pos}
        </button>
      ))}
    </div>
  );
}

export { POSITION_COLORS };
